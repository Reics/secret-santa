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
assert.match(html, /<input id="allowReroll"[^>]*\bchecked\b/);
function fakeElement() {
    return {
        hidden: false, disabled: false, textContent: '', value: '', style: { setProperty() {} },
        children: [], events: {}, attributes: {}, parentElement: {},
        addEventListener(type, handler) { this.events[type] = handler; },
        click() { if (!this.disabled && this.events.click) this.events.click(); },
        appendChild(child) { this.children.push(child); },
        replaceChildren(...children) { this.children = children; },
        querySelector() { return this.button ??= fakeElement(); },
        setAttribute(name, value) { this.attributes[name] = value; },
        removeAttribute() {},
        get firstElementChild() { return this.children[0]; },
        focus() {},
        select() {}
    };
}
const elements = new Map();
function getElementById(id) {
    if (!elements.has(id)) {
        const element = fakeElement();
        if (id === 'allowReroll') element.checked = true;
        elements.set(id, element);
    }
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
vm.runInContext("names.push('Ana', 'Beto'); remaining = [...names]; currentPlayer = 'Ana'; started = true; saveState();", page);

let pendingSnapshot;
let unsavedSnapshot;
function spinAndConfirm(expected) {
    const beforeSpin = storedValue;
    getElementById('spinBtn').events.click();
    assert.equal(storedValue, beforeSpin);
    frame(3000);
    assert.equal(getElementById('spinBtn').hidden, true);
    assert.equal(getElementById('changePlayerBtn').hidden, true);
    assert.equal(getElementById('confirmBtn').hidden, false);
    assert.equal(getElementById('confirmBtn').disabled, true);
    assert.equal(getElementById('rerollBtn').hidden, false);
    assert.equal(getElementById('rerollBtn').disabled, true);
    frame(3700);
    assert.equal(getElementById('confirmBtn').disabled, false);
    assert.equal(getElementById('rerollBtn').disabled, false);
    assert.equal(getElementById('wheelReveal').textContent, expected);
    const saved = JSON.parse(storedValue);
    assert.equal(saved.pending, null);
    assert.equal(saved.assignments.length, expected === 'Beto' ? 0 : 1);
    if (expected === 'Beto') {
        unsavedSnapshot = storedValue;
        pendingSnapshot = JSON.stringify({ ...saved, pending: expected });
        getElementById('rerollBtn').click();
        assert.equal(storedValue, beforeSpin);
        assert.equal(getElementById('wheelReveal').hidden, true);
        assert.equal(getElementById('confirmBtn').hidden, true);
        frame(3000);
        frame(3700);
        assert.equal(getElementById('wheelReveal').textContent, expected);
        assert.equal(storedValue, beforeSpin);
    }
    failWrites = true;
    getElementById('confirmBtn').events.click();
    assert.equal(getElementById('confirmBtn').hidden, false);
    assert.equal(getElementById('wheelReveal').textContent, expected);
    assert.equal(getElementById('storageAlert').hidden, false);
    assert.equal(JSON.parse(storedValue).pending, null);
    failWrites = false;
    getElementById('confirmBtn').events.click();
    assert.equal(getElementById('confirmBtn').hidden, true);
    assert.equal(getElementById('rerollBtn').hidden, true);
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

function reloadFrom(value, crypto = require('node:crypto').webcrypto, math = Math) {
    storedValue = value;
    const restored = new Map();
    function getRestored(id) {
        if (!restored.has(id)) {
            const element = fakeElement();
            if (id === 'allowReroll') element.checked = true;
            restored.set(id, element);
        }
        return restored.get(id);
    }
    const restoredWheel = getRestored('wheel');
    restoredWheel.width = restoredWheel.height = 400;
    restoredWheel.getContext = () => ctx;
    for (const id of ['game', 'confirmBtn', 'rerollBtn', 'wheelReveal', 'selectModal', 'storageAlert', 'discardSavedBtn',
        'adminBtn', 'setupCodeContainer', 'adminResults']) {
        getRestored(id).hidden = true;
    }
    const reloadedPage = vm.createContext({
        document: { getElementById: getRestored, createElement: fakeElement },
        localStorage,
        window: { crypto },
        crypto,
        Math: math,
        TextEncoder,
        confirm: () => true,
        console: { error() {} },
        performance: { now: () => 0 },
        requestAnimationFrame(callback) { frame = callback; }
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
failWrites = true;
pendingPage('rerollBtn').click();
assert.equal(storedValue, pendingSnapshot);
assert.equal(pendingPage('wheelReveal').textContent, 'Beto');
assert.equal(pendingPage('storageAlert').hidden, false);
failWrites = false;
pendingPage('rerollBtn').click();
assert.equal(JSON.parse(storedValue).pending, null);
frame(3000);
frame(3700);
assert.equal(pendingPage('wheelReveal').textContent, 'Beto');
assert.equal(JSON.parse(storedValue).assignments.length, 0);
const unconfirmedPage = reloadFrom(unsavedSnapshot);
assert.equal(unconfirmedPage('wheelReveal').hidden, true);
assert.equal(unconfirmedPage('confirmBtn').hidden, true);
assert.equal(unconfirmedPage('turn').textContent, 'Turno de Ana');
const draws = [0, 0, 0.99, 0];
const controlledMath = Object.create(Math);
controlledMath.random = () => draws.shift();
const beforeReroll = JSON.stringify({
    version: 1, started: true, names: ['Ana', 'Beto', 'Ceci'], assignments: [],
    currentPlayer: 'Ana', pending: null
});
const rerollPage = reloadFrom(beforeReroll, undefined, controlledMath);
rerollPage('spinBtn').click();
frame(3000);
frame(3700);
assert.equal(rerollPage('wheelReveal').textContent, 'Beto');
rerollPage('rerollBtn').click();
frame(3000);
frame(3700);
assert.equal(rerollPage('wheelReveal').textContent, 'Ceci');
assert.equal(storedValue, beforeReroll);
rerollPage('confirmBtn').click();
assert.deepEqual(JSON.parse(storedValue).assignments, [{ player: 'Ana', target: 'Ceci' }]);
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

{
    const setup = reloadFrom(null);
    for (const name of ['Ana', 'Beto', 'Ceci']) {
        setup('nameInput').value = name;
        setup('nameForm').events.submit({ preventDefault() {} });
    }
    const list = setup('namesPreview');
    list.children[0].click();
    assert.equal(list.children[0].attributes['aria-pressed'], 'true');
    assert.equal(JSON.parse(storedValue).names.length, 3);
    list.children[1].click();
    assert.equal(list.children[0].attributes['aria-pressed'], 'false');
    assert.equal(list.children[1].attributes['aria-pressed'], 'true');
    list.children[1].click();
    assert.deepEqual(JSON.parse(storedValue).names, ['Ana', 'Ceci']);
    assert.equal(setup('startBtn').disabled, false);
    assert.equal(reloadFrom(storedValue)('namesPreview').children.length, 2);

    list.children[0].click();
    failWrites = true;
    list.children[0].click();
    assert.equal(list.children.length, 2);
    assert.deepEqual(JSON.parse(storedValue).names, ['Ana', 'Ceci']);
    assert.equal(setup('storageAlert').hidden, false);
    failWrites = false;
    list.children[0].click();
    assert.deepEqual(JSON.parse(storedValue).names, ['Ceci']);
    assert.equal(setup('startBtn').disabled, true);
    console.log('Los participantes se seleccionan y eliminan en dos pulsaciones, con guardado seguro.');
}

(async () => {
    const setup = reloadFrom(null);
    for (const name of ['Ana', 'Beto']) {
        setup('nameInput').value = name;
        setup('nameForm').events.submit({ preventDefault() {} });
    }
    setup('saveChain').checked = true;
    setup('saveChain').events.change();
    assert.equal(setup('setupCodeContainer').hidden, false);
    setup('setupCode').value = '123';
    await setup('startBtn').events.click();
    assert.equal(setup('game').hidden, true);
    assert.match(setup('error').textContent, /4 dígitos/);
    setup('setupCode').value = '0123';
    await setup('startBtn').events.click();
    assert.equal(setup('adminBtn').hidden, false);
    const saved = storedValue;
    assert.match(JSON.parse(saved).adminHash, /^[0-9a-f]{64}$/);
    assert.notEqual(JSON.parse(saved).adminHash, '0123');

    const restored = reloadFrom(saved);
    assert.equal(restored('adminBtn').hidden, false);
    restored('adminBtn').events.click();
    restored('adminCode').value = '1234';
    await restored('adminForm').events.submit({ preventDefault() {} });
    assert.equal(restored('adminError').textContent, 'Clave incorrecta.');
    restored('adminCode').value = '0123';
    await restored('adminForm').events.submit({ preventDefault() {} });
    assert.equal(restored('adminResults').hidden, false);
    restored('resetBtn').events.click();
    assert.equal(restored('adminBtn').hidden, true);
    assert.equal(JSON.parse(storedValue).adminHash, null);

    const noAdmin = reloadFrom(null);
    for (const name of ['Ana', 'Beto']) {
        noAdmin('nameInput').value = name;
        noAdmin('nameForm').events.submit({ preventDefault() {} });
    }
    await noAdmin('startBtn').events.click();
    assert.equal(noAdmin('adminBtn').hidden, true);
    assert.equal(reloadFrom(storedValue)('adminBtn').hidden, true);
    assert.equal(reloadFrom(completedSnapshot)('adminBtn').hidden, true);
    console.log('El acceso opcional usa el código elegido y se restaura correctamente.');

    let finishHash;
    const slowCrypto = { subtle: { digest: () => new Promise(resolve => { finishHash = resolve; }) } };
    const racing = reloadFrom(null, slowCrypto);
    for (const name of ['Ana', 'Beto']) {
        racing('nameInput').value = name;
        racing('nameForm').events.submit({ preventDefault() {} });
    }
    racing('saveChain').checked = true;
    racing('setupCode').value = '1234';
    const start = racing('startBtn').events.click();
    racing('namesPreview').children[0].click();
    racing('namesPreview').children[0].click();
    finishHash(new Uint8Array(32).buffer);
    await start;
    assert.equal(racing('game').hidden, true);
    assert.equal(racing('startBtn').disabled, true);
    assert.equal(JSON.parse(storedValue).started, false);

    const options = reloadFrom(null);
    assert.equal(options('allowReroll').checked, true);
    options('allowReroll').checked = false;
    failWrites = true;
    options('allowReroll').events.change();
    assert.equal(options('allowReroll').checked, true);
    assert.equal(options('storageAlert').hidden, false);
    failWrites = false;
    options('allowReroll').checked = false;
    options('allowReroll').events.change();
    assert.equal(JSON.parse(storedValue).allowReroll, false);
    const savedOptions = reloadFrom(storedValue);
    assert.equal(savedOptions('allowReroll').checked, false);
    for (const name of ['Ana', 'Beto']) {
        savedOptions('nameInput').value = name;
        savedOptions('nameForm').events.submit({ preventDefault() {} });
    }
    await savedOptions('startBtn').events.click();
    savedOptions('playerList').children[0].click();
    const gameWithoutReroll = storedValue;
    savedOptions('spinBtn').click();
    frame(3000);
    frame(3700);
    assert.equal(savedOptions('rerollBtn').hidden, true);
    assert.equal(savedOptions('confirmBtn').hidden, false);
    assert.equal(storedValue, gameWithoutReroll);
    savedOptions('confirmBtn').click();
    assert.equal(JSON.parse(storedValue).assignments.length, 1);
    assert.equal(JSON.parse(storedValue).allowReroll, false);
    const legacyPending = JSON.stringify({ ...JSON.parse(pendingSnapshot), allowReroll: false });
    assert.equal(reloadFrom(legacyPending)('rerollBtn').hidden, true);
    const restoredGame = reloadFrom(gameWithoutReroll);
    restoredGame('spinBtn').click();
    frame(3000);
    frame(3700);
    assert.equal(restoredGame('rerollBtn').hidden, true);
    restoredGame('confirmBtn').click();
    restoredGame('resetBtn').events.click();
    assert.equal(restoredGame('allowReroll').checked, true);
    assert.equal(JSON.parse(storedValue).allowReroll, true);
    assert.equal(reloadFrom(completedSnapshot)('allowReroll').checked, true);
    console.log('La opción de volver a girar se guarda y respeta al restaurar.');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
