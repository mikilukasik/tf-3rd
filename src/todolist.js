import { html, mount, component, createState, handler } from '../../../litState/lib/index.js';

const globalState = createState({
  counter: 0,
  counter2: 0,
  nest: {},
  inputVal: '',
  buttonTextColor: 'blue',
});

globalState.nest2 = [null];

setInterval(() => (globalState.counter += 1), 1000);
setInterval(() => (globalState.counter2 += 1), 1600);
setInterval(() => (globalState.nest.val = Math.random()), 1300);
setInterval(() => (globalState.nest2[0] = Math.random()), 1850);

const Title = component(() => {
  return html`<h1>Hello World, this is nanoFlow. ${globalState.inputVal}</h1>`;
});

const Description = component(() => {
  return html`<p>I'm a tiny framework.</p>
    <div>Counter: ${globalState.counter}</div>`;
});

const AnotherCounter = component((props) => {
  return `${props.prefix} plain string Counter: ${globalState.counter2}`;
});

const DounbleCounter = component(() => {
  return html`<div>Combined Counter: ${globalState.counter} ${globalState.counter2}</div>`;
});

const UsingNested = component(() => {
  return html`<div>Nested: ${globalState.nest.val}</div>`;
});

const UsingNested2 = component(() => {
  return html`<div>Nested2: ${globalState.nest2[0]}</div>`;
});

const Counter = component(() => {
  return html`${globalState.counter}`;
});

const WithInput = component(() => {
  const inputHandler = handler(({ value }) => (globalState.inputVal = value));

  return html`<input oninput="${inputHandler}" /> c: ${Counter()}`;
});

const WithButton = component(({ label }) => {
  const clickHandler = handler(
    () => (globalState.buttonTextColor = globalState.buttonTextColor === 'blue' ? 'red' : 'blue'),
  );

  return html`<button style="color: ${globalState.buttonTextColor};" onclick="${clickHandler}">${label}</button>`;
});

const Root = component(() => {
  return html`<div>
    ${Title()} ${Description()} ${AnotherCounter({ prefix: 'first' })}, ${AnotherCounter({ prefix: 'second' })}
    <div style="background-color:lightblue;">${DounbleCounter()}</div>
    <div style="background-color:lightgreen;">${UsingNested()}</div>
    <div style="background-color:silver;">${UsingNested2()}</div>
    <div>${WithInput()}</div>
    <div>${WithButton({ label: 'Click here' })}</div>
  </div>`;
});

const container = document.getElementById('app-container');
mount(Root, container);

// import { createState, component, mount, html, handler } from 'litState';

// // Create a state object
// const state = createState({
//   tasks: [],
//   newTask: '',
// });

// // Define the Task component
// const Task = component(
//   ({ task, index }) => html`
//     <li>
//       ${task}
//       <button onclick="${handler(() => state.tasks.splice(index, 1))}">Delete</button>
//     </li>
//   `,
// );

// // Define the TodoList component
// const TodoList = component(
//   () => html`
//     <div>
//       <h2>Todo List</h2>
//       <input type="text" oninput="${handler((e) => (state.newTask = e.value))}" />
//       <button
//         onclick="${handler(() => {
//           if (state.newTask.trim()) {
//             state.tasks.push(state.newTask.trim());
//             state.newTask = '';
//           }
//         })}"
//       >
//         Add Task
//       </button>
//       <ul>
//         ${state.tasks.map((task, index) => Task({ task, index })).join('')}
//       </ul>
//     </div>
//   `,
// );

// // Mount the TodoList component to the DOM
// const container = document.querySelector('#app-container');
// mount(TodoList, container);
