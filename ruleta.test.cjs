const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname, 'intercambio.html'), 'utf8');
const source = html.match(/function eligibleTargets\([\s\S]*?\r?\n        }\r?\n/);
assert.ok(source, 'No se encontró la función de asignación');
const eligibleTargets = vm.runInNewContext(`(${source[0]})`);

function check(remaining, players) {
    if (players.length === 0) {
        assert.equal(remaining.length, 0);
        return;
    }
    for (const player of players) {
        const choices = eligibleTargets(remaining, players, player);
        assert.ok(choices.length, `Sin opciones para ${player}: ${remaining}`);
        for (const target of choices) {
            assert.notEqual(target, player);
            assert.ok(remaining.includes(target));
            check(remaining.filter(name => name !== target), players.filter(name => name !== player));
        }
    }
}

for (let count = 2; count <= 5; count++) {
    const players = Array.from({ length: count }, (_, index) => String(index));
    check(players, players);
}
for (let run = 0; run < 200; run++) {
    let players = Array.from({ length: 20 }, (_, index) => String(index));
    let remaining = [...players];
    while (players.length) {
        const player = players[Math.floor(Math.random() * players.length)];
        const choices = eligibleTargets(remaining, players, player);
        assert.ok(choices.length, `Sin opciones para ${player}: ${remaining}`);
        const target = choices[Math.floor(Math.random() * choices.length)];
        assert.notEqual(target, player);
        remaining = remaining.filter(name => name !== target);
        players = players.filter(name => name !== player);
    }
    assert.equal(remaining.length, 0);
}
console.log('Asignaciones válidas: órdenes de 2 a 5 participantes y sorteos de 20.');
