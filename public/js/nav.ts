// UTILITY FUNCTIONS
import { lerp } from '../../src/util/math/lerp';
const interpolateNormalizedViewport = lerp([ 0, 1 ], [ -75, 0 ]);

/** Encapsulates the state for touch interactions with the navigation side drawer. */
class TouchState {
  /** Threshold at which the delta must be in before it snaps to the next state. */
  static readonly DELTA_THRESHOLD = 0.1;
  /** Angle (in radians) with respect to the x-axis at which a `touchmove` is considered to be a horizontal swipe. */
  static readonly HORIZONTAL_ANGLE_THRESHOLD = Math.PI / 4;

  /** Reference to the `nav` menu DOM element. */
  #el_Nav: HTMLElement;
  /** Initial point of contact in relation to the client area (excluding scrollbars and browser UI). */
  #initTouch: [ number, number ] = [ 0, 0 ];
  /** Determines the direction of the `touchmove`. */
  #delta: [ number, number ] = [ 0, 0 ];
  /** Determines the angle at which the user swiped the screen. */
  #initAngle: number|null = null;
  /** Determines whether to ignore events if the user did not mean to swipe horizontally. */
  #isVerticalScroll = false;
  /** Determines whether it is necessary to schedule a draw call for updating the UI. */
  #hasPendingFrame = false;

  constructor(el_Nav: HTMLElement) { this.#el_Nav = el_Nav; }

  /** Resets touch state after every new touch. */
  touchStartHandler(event: TouchEvent) {
    event.stopPropagation();

    // Mutate the tuple in order to avoid generating a whole new array for each touch.
    // For mobile devices, this optimization can help preserve battery life.
    const { clientX, clientY } = event.touches[0];
    this.#initTouch[0] = clientX;
    this.#initTouch[1] = clientY;

    // Reset touch state
    this.#isVerticalScroll = false;
    this.#initAngle = null;
  }

  /** Calculates deltas and animates the UI on `touchmove`. */
  touchMoveHandler(event: TouchEvent) {
    event.stopPropagation();

    // Skip processing vertical scrolling
    if (this.#isVerticalScroll)
      return;

    // Disallow vertical scrolling since the user meant to swipe for the drawer
    event.preventDefault();

    // Calculate delta
    const { clientX, clientY } = event.touches[0];
    this.#delta[0] = clientX - this.#initTouch[0];
    this.#delta[1] = clientY - this.#initTouch[1];

    // Determine whether the user meant to scroll vertically
    if (this.#initAngle === null) {
      const magnitude = Math.sqrt(this.#delta[0] ** 2 + this.#delta[1] ** 2);
      this.#initAngle = Math.acos(this.#delta[0] / magnitude);

      if (TouchState.HORIZONTAL_ANGLE_THRESHOLD <= this.#initAngle && this.#initAngle <= Math.PI - TouchState.HORIZONTAL_ANGLE_THRESHOLD) {
        this.#isVerticalScroll = true;
        return;
      }

      // TODO: Detect left swipe and right swipe
    }

    // Conditionally queue draw calls.
    // The callback will update the UI based on the "last known"
    // deltas of the touch state. This is a necessary optimization
    // for mobile devices in order to avoid unnecessarily mutating
    // the DOM multiple times before the browser is even ready
    // to draw and update the DOM accordingly.
    if (!this.#hasPendingFrame) {
      window.requestAnimationFrame(() => {
        const normX = this.#delta[0] / document.body.clientWidth;
        this.#el_Nav.style.left = `${interpolateNormalizedViewport(normX)}vw`;
        this.#hasPendingFrame = false;
      });
      this.#hasPendingFrame = true;
    }
  }

  /** Concludes up the touch interaction by snapping the drawer to the appropriate state. */
  touchEndHandler(event: TouchEvent) {
    event.stopPropagation();

    // Skip processing taps
    if (this.#initAngle === null)
      return;

    // Skip processing vertical scrolls
    if (this.#isVerticalScroll)
      return;

    // Normalize the vectors
    window.requestAnimationFrame(() => {
      this.#el_Nav.removeAttribute('style');
      const normX = this.#delta[0] / document.body.clientWidth;
      if (Math.abs(normX) > TouchState.DELTA_THRESHOLD)
        this.#el_Nav.classList.toggle('visible');
    });
  }
}

// DOM ELEMENT REFERENCES
const { body } = document;
const nav = document.getElementById('nav-drawer')!;

// TOUCH EVENT HANDLERS
const state = new TouchState(nav);
const touchStartHandler = state.touchStartHandler.bind(state);
const touchMoveHandler = state.touchMoveHandler.bind(state);
const touchEndHandler = state.touchEndHandler.bind(state);

// EVENT BINDINGS
const options = { capture: true, passive: true };
body.addEventListener('touchstart', touchStartHandler, options);
body.addEventListener('touchmove', touchMoveHandler, { ...options, passive: false });
body.addEventListener('touchend', touchEndHandler, options);
body.addEventListener('touchcancel', touchEndHandler, options);
