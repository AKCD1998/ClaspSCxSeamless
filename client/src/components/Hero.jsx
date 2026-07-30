export default function Hero({ title, intro, children }) {
  return (
    <section className="hero">
      <p className="eyebrow">เว็บแอปปรับรูปแบบเอกสาร Seamless for DMIS</p>
      <h3>{title}</h3>
      <p className="intro">{intro}</p>
      {children}
    </section>
  );
}
