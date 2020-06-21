import { TouchState } from './core/TouchState';

// DOM ELEMENT REFERENCES
const { body: el_Body } = document;
const el_Nav = document.getElementById('nav-drawer')! as HTMLUListElement;
const el_HamburgerIcon = document.getElementsByClassName('brand-links__hamburger')[0]! as HTMLImageElement;

// TOUCH EVENT HANDLERS
const touchState = new TouchState(el_Nav);
const touchStartHandler = touchState.touchStartHandler.bind(touchState);
const touchMoveHandler = touchState.touchMoveHandler.bind(touchState);
const touchEndHandler = touchState.touchEndHandler.bind(touchState);

// CLICK EVENT HANDLERS
const hamburgerClickHandler = (event: MouseEvent): void => {
  event.stopPropagation();
  el_Nav.classList.add('visible');
  touchState.pollDrawerVisibility();
};

// EVENT BINDINGS
const options = { capture: true, passive: true };
el_Body.addEventListener('touchstart', touchStartHandler, options);
el_Body.addEventListener('touchmove', touchMoveHandler, { ...options, passive: false });
el_Body.addEventListener('touchend', touchEndHandler, options);
el_Body.addEventListener('touchcancel', touchEndHandler, options);
el_HamburgerIcon.addEventListener('click', hamburgerClickHandler, options);
