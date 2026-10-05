import assert from 'node:assert/strict';
// Source palette verification, not a substitute for rendered browser inspection.
function luminance(hex) {
  const c = hex.match(/\w\w/g).map(x => parseInt(x,16)/255).map(x => x <= 0.04045 ? x/12.92 : ((x+0.055)/1.055)**2.4);
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
for (const [name,fg,bg] of [
  ['input and dropdown text','172c26','ffffff'],['placeholder','66756e','ffffff'],
  ['readonly input','33493d','edf2ee'],['primary button','ffffff','16634c'],
  ['green label','1d663c','e4f2e8'],['yellow label','845515','fff1ce'],['red label','a12d27','fce9e6'],
]) {
  const a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  assert.ok(ratio>=4.5,`${name}: ${ratio.toFixed(2)} fails 4.5:1`);
  console.log(`${name}: ${ratio.toFixed(2)}:1 PASS`);
}
