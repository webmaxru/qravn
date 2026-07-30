/**
 * The qrrrgh mark: three QR finder patterns with the fourth corner left empty.
 *
 * That absence is real QR anatomy, a decoder works out the orientation of a
 * code from the missing fourth finder, and it is also the product's position:
 * this app reports what it found, never that something is safe. The corner
 * where a promise would go is left open.
 *
 * Geometry is the same 15 module field as brand/icon.svg. It inherits
 * currentColor so it works on paper and on inverted paper without a variant.
 */
export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 15 15"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor" fillRule="evenodd">
        <path d="M0,0 H7 V7 H0 Z M1,1 H6 V6 H1 Z M2,2 H5 V5 H2 Z" />
        <path d="M8,0 H15 V7 H8 Z M9,1 H14 V6 H9 Z M10,2 H13 V5 H10 Z" />
        <path d="M0,8 H7 V15 H0 Z M1,9 H6 V14 H1 Z M2,10 H5 V13 H2 Z" />
      </g>
    </svg>
  );
}
