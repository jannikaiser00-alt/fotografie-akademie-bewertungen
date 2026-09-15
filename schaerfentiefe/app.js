const $ = (id) => document.getElementById(id);
// Kreis der Zerstreuung und Crop-Faktoren entsprechen den Werten der Referenzanwendung.
const sensors = {
  webcam: { coc: 0.002, crop: 9.6, height: 3.6 }, smartphone: { coc: 0.002, crop: 6.1, height: 7.3 }, fullframe: { coc: 0.029, crop: 1, height: 24 }, apsc: { coc: 0.019, crop: 1.52, height: 15.6 },
  mft: { coc: 0.015, crop: 2, height: 13 }, medium66: { coc: 0.020, crop: 0.55, height: 60 }, medium67: { coc: 0.025, crop: 0.47, height: 70 }
};
const presets = { portrait:{distance:2.2,focal:85,aperture:1.8,sensor:'fullframe'}, street:{distance:3,focal:35,aperture:4,sensor:'fullframe'}, landscape:{distance:8,focal:24,aperture:8,sensor:'fullframe'}, macro:{distance:.55,focal:100,aperture:4,sensor:'fullframe'} };
const fmt = (meters, digits = 2) => meters < 1 ? `${Math.round(meters * 100)} cm` : meters >= 1000 ? `${(meters / 1000).toFixed(2).replace('.', ',')} km` : `${meters.toFixed(digits).replace('.', ',')} m`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
// Regler und Bühne verwenden dieselbe Skala, damit Motiv, Fokuslinie und
// Schärfegrenzen bei jeder Einstellung geometrisch deckungsgleich bleiben.
const sliderMinimum = 0.05;
const sliderMaximum = 10.16;
const sceneDistance = sliderMaximum;
const lensX = 184, lensY = 171, sceneRight = 1124, sceneTop = 10, sceneBottom = 335;
const xForDistance = (meters) => lensX + (clamp(meters, 0, sceneDistance) / sceneDistance) * (sceneRight - lensX);
const minimumDistanceFor = (focal) => Math.max(sliderMinimum, focal / 1000 + .001);
function setValue(id, value) { $(id).value = value; }
function calculate() {
  let distance = +$('distance').value; const focal = +$('focal').value, aperture = +$('aperture').value, sensor = sensors[$('sensor').value];
  const validMinimumDistance = minimumDistanceFor(focal); $('distance').min = validMinimumDistance;
  if (distance < validMinimumDistance) { distance = validMinimumDistance; $('distance').value = distance; }
  const subjectDistance = distance * 1000;
  // H = f²/(N·c)+f; Dn = H·s/(H+s−f); Df = H·s/(H−s+f)
  const hyperfocal = focal + (focal * focal) / (aperture * sensor.coc);
  const near = (hyperfocal * subjectDistance) / (hyperfocal + subjectDistance - focal);
  const farDenominator = hyperfocal - subjectDistance + focal;
  const infinity = farDenominator <= 0;
  const far = infinity ? Infinity : (hyperfocal * subjectDistance) / farDenominator;
  const nearM = near / 1000, farM = far / 1000, total = infinity ? Infinity : Math.max(0, farM - nearM), farOutsideScene = infinity || farM > sceneDistance;
  $('near-value').textContent = fmt(nearM); $('far-value').textContent = infinity ? '∞' : fmt(farM); $('dof-value').textContent = infinity ? '∞' : fmt(total); $('hyper-value').textContent = fmt(hyperfocal / 1000);
  $('distance-output').textContent = fmt(distance); $('focal-output').textContent = `${focal} mm`; $('aperture-output').textContent = `f/${aperture.toFixed(1)}`; $('scene-readout').textContent = `Fokus auf ${fmt(distance)}`; $('lens-readout').textContent = `${focal} mm · f/${aperture.toFixed(1)}`;
  const equivalent = Math.round(focal * sensor.crop); $('equivalent').textContent = sensor.crop === 1 ? '' : `Entspricht ungefähr ${equivalent} mm an Vollformat.`;
  const diffractionLimit = sensor.coc / 0.001342, warning = $('diffraction'); warning.hidden = aperture <= diffractionLimit; warning.textContent = `Hinweis: Ab etwa f/${diffractionLimit.toFixed(1)} kann Beugung die Detailschärfe an diesem Sensor verringern.`;
  const hyperButton = $('hyper-button'); hyperButton.disabled = hyperfocal / 1000 > sliderMaximum; hyperButton.title = hyperButton.disabled ? `Die hyperfokale Distanz (${fmt(hyperfocal / 1000)}) liegt außerhalb der 10,16-m-Szene.` : 'Auf die hyperfokale Distanz fokussieren';
  const subjectX = xForDistance(distance), nearX = xForDistance(nearM), farX = farOutsideScene ? sceneRight : xForDistance(farM);
  const safeNearX = clamp(nearX, 190, 1120), safeFarX = clamp(Math.max(farX, safeNearX + 4), safeNearX + 4, 1124);
  $('focus-cone').setAttribute('d', `M ${safeNearX} 84 L ${safeFarX} 84 L ${safeFarX} 335 L ${safeNearX} 335 Z`);
  const fov = 2 * Math.atan(sensor.height / (2 * focal));
  const slope = Math.tan(fov / 2), run = sceneRight - lensX;
  const topAtRight = lensY - slope * run, bottomAtRight = lensY + slope * run;
  const topPath = topAtRight < sceneTop ? `L ${lensX + (lensY - sceneTop) / slope} ${sceneTop} L ${sceneRight} ${sceneTop}` : `L ${sceneRight} ${topAtRight}`;
  const bottomPath = bottomAtRight > sceneBottom ? `L ${sceneRight} ${sceneBottom} L ${lensX + (sceneBottom - lensY) / slope} ${sceneBottom}` : `L ${sceneRight} ${bottomAtRight}`;
  const fovPath = `M ${lensX} ${lensY} ${topPath} L ${sceneRight} ${lensY} ${bottomPath} Z`;
  $('fov-cone').setAttribute('d', fovPath); $('fov-clip-path').setAttribute('d', fovPath);
  $('near-line').setAttribute('x1', safeNearX); $('near-line').setAttribute('x2', safeNearX); $('far-line').setAttribute('x1', safeFarX); $('far-line').setAttribute('x2', safeFarX); $('focus-line').setAttribute('x1', subjectX); $('focus-line').setAttribute('x2', subjectX);
  const showBoundaryLabels = !farOutsideScene && total > .4572;
  $('near-text').toggleAttribute('hidden', !showBoundaryLabels); $('far-text').toggleAttribute('hidden', !showBoundaryLabels);
  $('near-text').setAttribute('transform', `translate(${safeNearX - 8} ${sceneBottom - 8}) rotate(-90)`); $('far-text').setAttribute('transform', `translate(${safeFarX + 12} ${sceneTop + 10}) rotate(90)`); $('near-text').textContent = fmt(nearM); $('far-text').textContent = fmt(farM);
  $('dof-line').setAttribute('x1', safeNearX); $('dof-line').setAttribute('x2', safeFarX); $('dof-left-tick').setAttribute('x1', safeNearX); $('dof-left-tick').setAttribute('x2', safeNearX); $('dof-right-tick').setAttribute('x1', safeFarX); $('dof-right-tick').setAttribute('x2', safeFarX); $('dof-label').setAttribute('x', (safeNearX + safeFarX) / 2); $('dof-label').textContent = infinity ? 'Schärfentiefe bis ∞' : fmt(total);
  $('focus-label').setAttribute('x', subjectX); $('focus-label').textContent = fmt(distance);
  const subjectBaseY = $('subject-select').value === 'person' ? 165 : $('subject-select').value === 'dog' ? 285 : 300;
  ['person', 'dog', 'object'].forEach(kind => $(`subject-${kind}`).setAttribute('transform', `translate(${subjectX} ${subjectBaseY})`));
  ['person', 'dog', 'object'].forEach(kind => $(`focus-${kind}`).setAttribute('transform', `translate(${subjectX} ${subjectBaseY})`));
}
['distance', 'focal', 'aperture', 'sensor'].forEach(id => $(id).addEventListener('input', () => { $('preset').value = 'custom'; calculate(); }));
$('preset').addEventListener('change', (event) => { const preset = presets[event.target.value]; if (preset) { Object.entries(preset).forEach(([key, value]) => setValue(key, value)); calculate(); } });
$('subject-select').addEventListener('change', (event) => {
  ['person', 'dog', 'object'].forEach((kind) => {
    const shouldHide = kind !== event.target.value;
    $(`subject-${kind}`).toggleAttribute('hidden', shouldHide);
    $(`focus-${kind}`).toggleAttribute('hidden', shouldHide);
  });
  calculate();
});
$('hyper-button').addEventListener('click', () => { const focal = +$('focal').value, aperture = +$('aperture').value, coc = sensors[$('sensor').value].coc; const hyperfocal = (focal + (focal * focal) / (aperture * coc)) / 1000; if (hyperfocal <= sliderMaximum) { setValue('distance', clamp(hyperfocal, minimumDistanceFor(focal), sliderMaximum)); $('preset').value = 'custom'; calculate(); } });
$('theme-toggle').addEventListener('click', () => { document.body.classList.toggle('dark'); $('theme-toggle').textContent = document.body.classList.contains('dark') ? '☀' : '☾'; });
const sceneSvg = document.querySelector('.scene-svg');
let draggingScene = false;
function setDistanceFromPointer(event) { const point = sceneSvg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY; const svgPoint = point.matrixTransform(sceneSvg.getScreenCTM().inverse()); const distance = ((clamp(svgPoint.x, lensX, sceneRight) - lensX) / (sceneRight - lensX)) * sceneDistance; const focal = +$('focal').value; setValue('distance', clamp(distance, minimumDistanceFor(focal), sliderMaximum)); $('preset').value = 'custom'; calculate(); }
sceneSvg.addEventListener('pointerdown', (event) => { draggingScene = true; sceneSvg.setPointerCapture(event.pointerId); setDistanceFromPointer(event); });
sceneSvg.addEventListener('pointermove', (event) => { if (draggingScene) setDistanceFromPointer(event); });
sceneSvg.addEventListener('pointerup', () => { draggingScene = false; });
sceneSvg.addEventListener('pointercancel', () => { draggingScene = false; });
sceneSvg.addEventListener('lostpointercapture', () => { draggingScene = false; });
calculate();
