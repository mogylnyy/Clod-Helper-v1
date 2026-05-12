interface Props {
  code: string;
}

export function CountryFlag({ code }: Props) {
  const low = code.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/16x12/${low}.png`}
      srcSet={`https://flagcdn.com/32x24/${low}.png 2x, https://flagcdn.com/48x36/${low}.png 3x`}
      alt={code.toUpperCase()}
      width={16}
      height={12}
      className="inline-block shrink-0 rounded-[2px]"
      style={{ imageRendering: "auto", objectFit: "cover" }}
    />
  );
}
