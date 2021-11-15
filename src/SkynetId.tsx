import Color from "color";

type UserId = string;

function getBgColorForHexString(s: string): Color {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < s.length; ) {
    const rByte = (s.substr(i, 2) + "00").substr(0, 2);
    const gByte = (s.substr(i + 2, 2) + "00").substr(0, 2);
    const bByte = (s.substr(i + 4, 2) + "00").substr(0, 2);
    i += 6;
    r ^= parseInt(rByte, 16);
    g ^= parseInt(gByte, 16);
    b ^= parseInt(bByte, 16);
  }
  return Color.rgb(r, g, b);
}

export default function SkynetId({
  id,
  style,
}: {
  id: UserId;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        padding: "0.2em",
        fontWeight: "bold",
        borderRadius: "5px",
        ...style,
        backgroundColor: getBgColorForHexString(id).hex(),
        color: getBgColorForHexString(id).isDark() ? "white" : "black",
      }}
    >{`${id.substr(0, 5)}...${id.substr(-5)}`}</span>
  );
}
