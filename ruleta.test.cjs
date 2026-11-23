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
{
    let remaining = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabian', 'Gabriela', 'Hugo', 'Iris', 'Jorge'];
    let players = [...remaining];
    const assignments = [];
    const turns = [
        ['Ana', 'Bruno'], ['Carla', 'Ana'], ['Bruno', 'Diego'], ['Diego', 'Elena'],
        ['Elena', 'Fabian'], ['Fabian', 'Gabriela'], ['Gabriela', 'Hugo'],
        ['Hugo', 'Iris'], ['Iris', 'Jorge'], ['Jorge', 'Carla']
    ];
    for (const [player, target] of turns) {
        assert.ok(eligibleTargets(remaining, players, player, assignments).includes(target));
        assignments.push({ player, target });
        remaining = remaining.filter(name => name !== target);
        players = players.filter(name => name !== player);
    }
    assertSingleCycle(assignments);
    assert.equal(assignments[1].target, assignments[0].player);
    assert.notEqual(assignments[assignments.length - 1].target, assignments[0].player);
    assert.equal(remaining.length, 0);
}
for (let run = 0; run < 200; run++) {
    let players = Array.from({ length: 50 }, (_, index) => String(index));
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
console.log('Un solo círculo válido: órdenes de 2 a 5 participantes y sorteos de 50.');

const validationSource = html.match(/function validSavedState\([\s\S]*?\r?\n        }\r?\n/);
assert.ok(validationSource, 'No se encontró la validación del progreso guardado');
const validSavedState = vm.runInNewContext(`(${validationSource[0]})`, { eligibleTargets });
const fiftyNames = Array.from({ length: 50 }, (_, index) => `Persona ${index + 1}`);
const savedFifty = {
    version: 1, started: true, names: fiftyNames,
    assignments: fiftyNames.map((player, index) => ({ player, target: fiftyNames[(index + 1) % 50] })),
    currentPlayer: null, pending: null
};
assert.equal(validSavedState(savedFifty), true);
assert.equal(validSavedState({ ...savedFifty, names: [...fiftyNames, 'Persona 51'] }), false);
console.log('El progreso acepta 50 participantes y rechaza 51.');

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

const wheelSource = html.match(/function drawWheel\([\s\S]*?\r?\n        }\r?\n/);
assert.ok(wheelSource, 'No se encontró la función de la ruleta');
let rotation = 0;
const stack = [];
const rotations = [];
const textRotations = [];
const boxRotations = [];
const ctx = {
    save() { stack.push(rotation); },
    restore() { rotation = stack.pop(); },
    rotate(value) { rotation += value; rotations.push(value); },
    fillText() { textRotations.push(rotation); },
    fillRect() { boxRotations.push(rotation); },
    clearRect() {}, translate() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    moveTo() {}, bezierCurveTo() {}
};
const drawWheel = vm.runInNewContext(`(${wheelSource[0]})`, {
    ctx, canvas: { width: 400, height: 400 }, angle: 1.2
});
drawWheel(0);
assert.equal(rotations[0], 1.2);
assert.ok(textRotations.every(value => value === 0));
assert.ok(boxRotations.every(value => value === 0));
textRotations.length = 0;
boxRotations.length = 0;
drawWheel(1);
assert.ok(textRotations.every(value => value === 0));
assert.equal(boxRotations[0], 0);
assert.ok(boxRotations.some(value => value !== 0));
assert.equal(stack.length, 0);
console.log('Solo gira el aro; el regalo se abre sin girar las letras.');

const script = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script, 'No se encontró el código de la página');
function fakeElement() {
    return {
        hidden: false, disabled: false, textContent: '', style: {}, children: [], events: {},
        addEventListener(type, handler) { this.events[type] = handler; },
        click() { if (!this.disabled && this.events.click) this.events.click(); },
        appendChild(child) { this.children.push(child); },
        replaceChildren(...children) { this.children = children; },
        get firstElementChild() { return this.children[0]; },
        focus() {}
    };
}
const elements = new Map();
function getElementById(id) {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id);
}
const wheel = getElementById('wheel');
wheel.width = wheel.height = 400;
wheel.getContext = () => ctx;
getElementById('confirmBtn').hidden = true;
getElementById('wheelReveal').hidden = true;
getElementById('selectModal').hidden = true;
let frame;
let storedValue = null;
let failWrites = false;
const localStorage = {
    getItem() { return storedValue; },
    setItem(key, value) {
        if (failWrites) throw new Error('Almacenamiento no disponible');
        storedValue = value;
    },
    removeItem() { storedValue = null; }
};
const page = vm.createContext({
    document: { getElementById, createElement: fakeElement },
    performance: { now: () => 0 },
    requestAnimationFrame(callback) { frame = callback; },
    localStorage,
    console: { error() {} }
});
vm.runInContext(script[1], page);
vm.runInContext("names.push('Ana', 'Beto'); remaining = [...names]; currentPlayer = 'Ana'; started = true;", page);

let pendingSnapshot;
function spinAndConfirm(expected) {
    getElementById('spinBtn').events.click();
    frame(3000);
    assert.equal(getElementById('spinBtn').hidden, true);
    assert.equal(getElementById('changePlayerBtn').hidden, true);
    assert.equal(getElementById('confirmBtn').hidden, false);
    assert.equal(getElementById('confirmBtn').disabled, true);
    frame(3700);
    assert.equal(getElementById('confirmBtn').disabled, false);
    assert.equal(getElementById('wheelReveal').textContent, expected);
    const saved = JSON.parse(storedValue);
    assert.equal(saved.pending, expected);
    assert.equal(saved.assignments.length, expected === 'Beto' ? 0 : 1);
    if (expected === 'Beto') pendingSnapshot = storedValue;
    failWrites = true;
    getElementById('confirmBtn').events.click();
    assert.equal(getElementById('confirmBtn').hidden, false);
    assert.equal(getElementById('wheelReveal').textContent, expected);
    assert.equal(getElementById('storageAlert').hidden, false);
    assert.equal(JSON.parse(storedValue).pending, expected);
    failWrites = false;
    getElementById('confirmBtn').events.click();
    assert.equal(getElementById('confirmBtn').hidden, true);
    assert.equal(getElementById('wheelReveal').hidden, true);
    assert.equal(getElementById('wheelReveal').textContent, '');
}
spinAndConfirm('Beto');
const partialSnapshot = storedValue;
assert.equal(getElementById('selectModal').hidden, false);
assert.equal(getElementById('spinBtn').hidden, false);
assert.equal(getElementById('changePlayerBtn').hidden, false);
vm.runInContext("currentPlayer = 'Beto';", page);
spinAndConfirm('Ana');
assert.equal(getElementById('spinBtn').hidden, true);
assert.equal(getElementById('changePlayerBtn').hidden, true);
assert.equal(getElementById('progress').textContent, '2 de 2 participantes han girado.');
console.log('La confirmación reemplaza los botones y restaura el siguiente turno.');

function reloadFrom(value) {
    storedValue = value;
    const restored = new Map();
    function getRestored(id) {
        if (!restored.has(id)) restored.set(id, fakeElement());
        return restored.get(id);
    }
    const restoredWheel = getRestored('wheel');
    restoredWheel.width = restoredWheel.height = 400;
    restoredWheel.getContext = () => ctx;
    for (const id of ['game', 'confirmBtn', 'wheelReveal', 'selectModal', 'storageAlert', 'discardSavedBtn']) {
        getRestored(id).hidden = true;
    }
    const reloadedPage = vm.createContext({
        document: { getElementById: getRestored, createElement: fakeElement },
        localStorage,
        console: { error() {} },
        performance: { now: () => 0 },
        requestAnimationFrame() { throw new Error('No debe girar al restaurar'); }
    });
    vm.runInContext(script[1], reloadedPage);
    return getRestored;
}

const pendingPage = reloadFrom(pendingSnapshot);
assert.equal(pendingPage('wheelReveal').textContent, 'Beto');
assert.equal(pendingPage('confirmBtn').hidden, false);
assert.equal(pendingPage('spinBtn').disabled, true);
pendingPage('wheel').click();
assert.equal(storedValue, pendingSnapshot);
const partialPage = reloadFrom(partialSnapshot);
assert.equal(partialPage('selectModal').hidden, false);
assert.equal(partialPage('playerList').children[0].textContent, 'Beto');
const completedSnapshot = JSON.stringify({
    version: 1, started: true, names: ['Ana', 'Beto'],
    assignments: [{ player: 'Ana', target: 'Beto' }, { player: 'Beto', target: 'Ana' }],
    currentPlayer: null, pending: null
});
const completedPage = reloadFrom(completedSnapshot);
assert.equal(completedPage('progress').textContent, '2 de 2 participantes han girado.');
assert.equal(completedPage('spinBtn').hidden, true);
const corruptPage = reloadFrom('{dañado');
assert.equal(corruptPage('storageAlert').hidden, false);
assert.equal(corruptPage('discardSavedBtn').hidden, false);
assert.equal(storedValue, '{dañado');
const invalidCycle = JSON.stringify({
    version: 1, started: true, names: ['Ana', 'Beto', 'Ceci'],
    assignments: [{ player: 'Ana', target: 'Beto' }, { player: 'Beto', target: 'Ana' }],
    currentPlayer: null, pending: null
});
const invalidPage = reloadFrom(invalidCycle);
assert.equal(invalidPage('storageAlert').hidden, false);
assert.equal(invalidPage('discardSavedBtn').hidden, false);
assert.equal(storedValue, invalidCycle);
console.log('El progreso pendiente, parcial y final se restaura sin repetir giros.');
