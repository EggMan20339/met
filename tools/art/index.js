// Every art module, by path relative to this folder (without .js). tools/make-art.js exports their stills to art/,
// tools/bundle-src.js wraps them for the browser as ARTSRC.<basename>. A module is either an animated character
// (exports name, w, h, anchor, params, poses, make, control; see art/ANIMATION.md) or a sheet of static stills
// (exports { stills: { name: { w, h, anchor, make } } }). Modules not written yet are skipped.
module.exports = [
  'mote',
  'creatures/dimling', 'creatures/hushmoth', 'creatures/sporeling', 'creatures/rootram', 'creatures/snuffer', 'creatures/emberback', 'creatures/gloamwing', 'creatures/springfoot', 'creatures/husk',
  'bosses/gulletroot', 'bosses/bell', 'bosses/lightless',
  'friends/wick', 'friends/bramble', 'friends/tallow', 'friends/ringer',
  'props/hearth', 'props/lamp', 'props/crystal', 'props/puffcap', 'props/pickups', 'props/statics',
  'backgrounds',
];
