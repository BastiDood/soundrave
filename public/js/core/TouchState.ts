// UTILITY FUNCTIONS
import { lerp } from '../util/lerp';
const interpolateToViewport = lerp([ 0, 1 ], [ -75, 0 ]);
const interpolateOpacity = lerp([ 0, 1 ], [ 0, 0.5 ]);

/** Encapsulates the state for touch interactions with the navigation side drawer. */
export class TouchState {
  /** Threshold at which the delta must be in before it snaps to the next state. */
  static readonly DELTA_THRESHOLD = 0.2;
  /** Angle (in radians) with respect to the x-axis at which a `touchmove` is considered to be a horizontal swipe. */
  static readonly HORIZONTAL_ANGLE_THRESHOLD = Math.PI / 4;

  /** Reference to the `nav` menu DOM element. */
  #el_Nav: HTMLElement;
  /**  Reference to the element which serves as the backdrop when the drawer is visible. */
  #el_Backdrop: HTMLElement;
  /** Initial point of contact in relation to the client area (excluding scrollbars and browser UI). */
  #initTouch: [ number, number ] = [ 0, 0 ];
  /** Determines the direction of the `touchmove`. */
  #delta: [ number, number ] = [ 0, 0 ];
  /** Determines the angle at which the user swiped the screen. */
  #initAngle: number|null = null;
  /** Determines whether to ignore events if the user did not mean to swipe horizontally. */
  #isVerticalScroll = false;
  /** Determines whether the drawer is currently visible. */
  #isDrawerVisible = false;
  /** Determines whether it is necessary to schedule a draw call for updating the UI. */
  #hasPendingFrame = false;

  constructor(el_Nav: HTMLElement, el_Backdrop: HTMLElement) {
    this.#el_Nav = el_Nav;
    this.#el_Backdrop = el_Backdrop;
  }

  /** Resets touch state after every new touch. */
  touchStartHandler(event: TouchEvent): void {
    event.stopPropagation();

    // Mutate the tuple in order to avoid generating a whole new array for each touch.
    // For mobile devices, this optimization can help preserve battery life.
    const { clientX, clientY } = event.touches[0];
    this.#initTouch[0] = clientX;
    this.#initTouch[1] = clientY;

    // Reset touch state
    // this.#isDrawerVisible = this.#el_Nav.classList.contains('visible');
    this.#isVerticalScroll = false;
    this.#initAngle = null;
  }

  /** Calculates deltas and animates the UI on `touchmove`. */
  touchMoveHandler(event: TouchEvent): void {
    event.stopPropagation();

    // Skip processing vertical scrolling
    if (this.#isVerticalScroll) {
      if (event.cancelable && this.#isDrawerVisible)
        event.preventDefault();
      return;
    }

    if (event.cancelable)
      event.preventDefault();

    // Calculate delta of first touch point
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

      this.#el_Backdrop.style.zIndex = '1';
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

        if (this.#isDrawerVisible && normX < 0) {
          // Handle drawer close interaction
          const complementX = 1 + normX;
          this.#el_Nav.style.left = `${normX * 75}vw`;
          this.#el_Backdrop.style.opacity = (complementX * 0.25).toString();
        } else if (!this.#isDrawerVisible && normX > 0) {
          // Handle drawer open interaction
          this.#el_Nav.style.left = `${interpolateToViewport(normX)}vw`;
          this.#el_Backdrop.style.opacity = interpolateOpacity(normX).toString();
        }

        this.#hasPendingFrame = false;
      });
      this.#hasPendingFrame = true;
    }
  }

  /** Concludes up the touch interaction by snapping the drawer to the appropriate state. */
  touchEndHandler(event: TouchEvent): void {
    event.stopPropagation();

    // Skip processing taps
    if (this.#initAngle === null)
      return;

    // Skip processing vertical scrolls
    if (this.#isVerticalScroll)
      return;

    // Skip invalid swipes
    if (!this.#el_Nav.style.left)
      return;

    // Reset styles to allow snapping
    this.#el_Nav.removeAttribute('style');
    this.#el_Backdrop.removeAttribute('style');

    // Normalize the vectors
    const normX = this.#delta[0] / document.body.clientWidth;

    // Ensure that the drag threshold (in either direction)
    // is enough to break the snap
    if (Math.abs(normX) < TouchState.DELTA_THRESHOLD)
      return;

    this.toggleDrawerVisibility();
  }

  /** Control drawer visibility. */
  toggleDrawerVisibility(): void {
    this.#el_Nav.classList.toggle('visible', !this.#isDrawerVisible);
    this.#isDrawerVisible = this.#el_Backdrop.classList.toggle('visible', !this.#isDrawerVisible);
  }
}
