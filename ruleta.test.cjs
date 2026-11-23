const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname, 'intercambio.html'), 'utf8');
const source = html.match(/function eligibleTargets\([\s\S]*?\r?\n        }\r?\n/);
assert.ok(source, 'No se encontró la función de asignación');
const eligibleTargets = vm.runInNewContext(`(${source[0]})`);

function assertSingleCycle(assignments) {
    const next = new Map(assignments.map(pair => [pair.player, pair.target]));
    const start = assignments[0].player;
    const visited = new Set();
    let player = start;
    while (!visited.has(player)) {
        assert.ok(next.has(player));
        visited.add(player);
        player = next.get(player);
    }
    assert.equal(player, start);
    assert.equal(visited.size, assignments.length);
}

function check(remaining, players, assignments = []) {
    if (players.length === 0) {
        assert.equal(remaining.length, 0);
        assertSingleCycle(assignments);
        return;
    }
    for (const player of players) {
        const choices = eligibleTargets(remaining, players, player, assignments);
        assert.ok(choices.length, `Sin opciones para ${player}: ${remaining}`);
        for (const target of choices) {
            assert.notEqual(target, player);
            assert.ok(remaining.includes(target));
            check(remaining.filter(name => name !== target), players.filter(name => name !== player),
                [...assignments, { player, target }]);
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
    const assignments = [];
    while (players.length) {
        const player = players[Math.floor(Math.random() * players.length)];
        const choices = eligibleTargets(remaining, players, player, assignments);
        assert.ok(choices.length, `Sin opciones para ${player}: ${remaining}`);
        const target = choices[Math.floor(Math.random() * choices.length)];
        assert.notEqual(target, player);
        assignments.push({ player, target });
        remaining = remaining.filter(name => name !== target);
        players = players.filter(name => name !== player);
    }
    assert.equal(remaining.length, 0);
    assertSingleCycle(assignments);
}
console.log('Un solo círculo válido: órdenes de 2 a 5 participantes y sorteos de 20.');

const chainsSource = html.match(/function assignmentChains\([\s\S]*?\r?\n        }\r?\n/);
assert.ok(chainsSource, 'No se encontró la función de la guirnalda');
const assignmentChains = vm.runInNewContext(`(${chainsSource[0]})`);
const names = ['Ana', 'Beto', 'Ceci', 'Dani', 'Eva'];
const partial = [{ player: 'Ana', target: 'Ceci' }, { player: 'Beto', target: 'Dani' }];
assert.equal(Array.from(assignmentChains(names, partial), chain => chain.join(' → ')).join(' | '),
    'Ana → Ceci | Beto → Dani | Eva');
const complete = [...partial, { player: 'Ceci', target: 'Beto' },
    { player: 'Dani', target: 'Eva' }, { player: 'Eva', target: 'Ana' }];
assert.equal(Array.from(assignmentChains(names, complete), chain => chain.join(' → ')).join(' | '),
    'Ana → Ceci → Beto → Dani → Eva');
console.log('Guirnalda correcta durante y después del sorteo.');
