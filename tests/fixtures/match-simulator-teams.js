function player(id, position, overall) {
  const base = overall;
  return { playerId: id, name: `${position} ${id}`, position, overall, stats: { attack: base, physical: base, stamina: base, control: base, defense: base, speed: base, grit: base, save: position === 'GK' ? base : Math.max(1, base - 30) } };
}
function makeTeam(prefix, type = 'eleven', overall = 60) {
  const roles = type === 'five' ? ['FW','MF','MF','DF','GK'] : ['FW','FW','FW','MF','MF','MF','DF','DF','DF','DF','GK'];
  return { name: prefix, players: roles.map((r, i) => player(`${prefix}_${r}_${i}`, r, overall)) };
}
module.exports = { makeTeam, player };
