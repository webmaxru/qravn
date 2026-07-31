/**
 * The QRavn mark: one QR finder pattern with the ring left open.
 *
 * The 7x7 ring, 1-module gap and 3x3 core give the 1:1:3:1:1 run of modules a
 * decoder hunts for along any scan line, so this is not a shape inspired by a
 * QR code, it is what "QR code" means to a machine. Cutting the bottom-right
 * corner leaves the ring unclosed, which is the product's position: this app
 * reports what it found and never closes the loop by calling something safe.
 *
 * Geometry matches brand/mark.svg. It inherits currentColor so it works on
 * either ground without a variant.
 */
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 7 7"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M0,0 H7 V5.5 H6 V1 H1 V6 H5.5 V7 H0 Z M2,2 H5 V5 H2 Z"
      />
    </svg>
  );
}
