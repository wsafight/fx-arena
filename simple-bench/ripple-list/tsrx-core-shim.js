// Shim for @tsrx/core. See VERSIONS.md for why this exists.
// The upstream @tsrx/core barrel has side-effect imports (acorn, TS
// parser, full compiler plugin) that defeat tree-shaking, so importing
// 7 tiny runtime helpers pulls 450KB of compiler into the SPA bundle.
// We vendor the two source files that own those helpers (tsrx-events.js,
// tsrx-css.js) and re-export with the public camelCase names ripple's
// client runtime expects. Wired up via resolve.alias in vite.config.js.

export {
  event_name_from_capture as eventNameFromCapture,
  is_capture_event as isCaptureEvent,
  is_non_delegated as isNonDelegated,
  is_passive_event as isPassiveEvent,
  get_attribute_event_name as getAttributeEventName,
  is_event_attribute as isEventAttribute
} from './tsrx-events.js';

export { normalize_css_property_name as normalizeCssPropertyName } from './tsrx-css.js';
