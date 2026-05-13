interface FBRLogoProps {
  size?: number;
  invert?: boolean;
}

export const FBRLogo = ({ size = 36 }: FBRLogoProps) => (
  <img
    src="/fbr-logo.png"
    alt="Федерация бокса России"
    style={{
      height: size,
      width: 'auto',
      objectFit: 'contain',
      flexShrink: 0,
    }}
  />
);
