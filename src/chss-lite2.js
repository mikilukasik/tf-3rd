import { html, mount, component, createState, handler } from '../../../litState/lib';
import { Router, Link } from '../../../litState/lib/components';

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
  const inputHandler = handler((e, t) => (globalState.inputVal = e.target.value));

  return html`<input oninput="${inputHandler}" /> c: ${Counter()}`;
});

const WithButton = component(({ label }) => {
  const clickHandler = handler(
    () => (globalState.buttonTextColor = globalState.buttonTextColor === 'blue' ? 'red' : 'blue'),
  );

  return html`<button style="color: ${globalState.buttonTextColor};" onclick="${clickHandler}">${label}</button>`;
});

const Page1 = component(
  () => html`<div>
    ${Title()} ${Description()} ${AnotherCounter({ prefix: 'first' })}, ${AnotherCounter({ prefix: 'second' })}
    <div style="background-color:lightblue;">${DounbleCounter()}</div>
    <div style="background-color:lightgreen;">${UsingNested()}</div>
    <div style="background-color:silver;">${UsingNested2()}</div>
    <div>${WithInput()}</div>
    <div>${WithButton({ label: 'Click here' })}</div>
    ${Link({ to: '/', children: 'Go to Home page' })}
  </div>`,
);

// Route components
const Home = component(
  () => html`
    <div>
      <h2>Home</h2>
      <p>Welcome to the Home page!</p>
      ${Link({ to: '/about', children: 'Go to About page' })} ${Link({ to: '/page1', children: 'Go to Page 1' })}
    </div>
  `,
);

const About = component(
  () => html`
    <div>
      <h2>About</h2>
      <p>Welcome to the About page!</p>
      ${Link({ to: '/', children: 'Go to Home page' })}
    </div>
  `,
);

const NotFound = component(
  () => html`
    <div>
      <h2>404 - Not Found</h2>
      <p>The requested page could not be found.</p>
      ${Link({ to: '/', children: 'Go to Home page' })}
    </div>
  `,
);

const Header = component(() => html` <div>I am the header</div> `);

const routes = {
  '/': Home,
  '/about': About,
  '/page1': Page1,
  '*': NotFound,
};

const App = component(() => {
  return html`
    <div>${Header()}</div>
    <div>${Router({ routes })}</div>
  `;
});

const container = document.getElementById('app-container');
mount(App, container);
