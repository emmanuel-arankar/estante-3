import React from 'react';

interface GifRoundedIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  background?: string;
  opacity?: number;
  rotation?: number;
  shadow?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  padding?: number;
}

const GifRoundedIcon = ({
  size = undefined,
  color = '#000000',
  strokeWidth = 0,
  background = 'transparent',
  opacity = 1,
  rotation = 0,
  shadow = 0,
  flipHorizontal = false,
  flipVertical = false,
  padding = 0,
  style,
  ...props
}: GifRoundedIconProps) => {
  const transforms = [];
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipHorizontal) transforms.push('scaleX(-1)');
  if (flipVertical) transforms.push('scaleY(-1)');

  const viewBoxSize = 24 + (padding * 2);
  const viewBoxOffset = -padding;
  const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        opacity,
        transform: transforms.join(' ') || undefined,
        filter: shadow > 0 ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))` : undefined,
        backgroundColor: background !== 'transparent' ? background : undefined,
        ...style
      }}
      {...props}
    >
      <path fill="currentColor" d="M4 17q-.825 0-1.412-.587T2 15V9q0-.825.588-1.412T4 7h5q.425 0 .713.288T10 8t-.288.713T9 9H4v6h4v-2H7q-.425 0-.712-.288T6 12t.288-.712T7 11h2q.425 0 .713.288T10 12v3q0 .825-.587 1.413T8 17zm8-1V8q0-.425.288-.712T13 7t.713.288T14 8v8q0 .425-.288.713T13 17t-.712-.288T12 16m4 0V8q0-.425.288-.712T17 7h5q.425 0 .713.288T23 8t-.288.713T22 9h-4v2h3q.425 0 .713.288T22 12t-.288.713T21 13h-3v3q0 .425-.288.713T17 17t-.712-.288T16 16" />
    </svg>
  );
};

export default GifRoundedIcon;
