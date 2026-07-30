export default function AnimatedThemeBackground({ theme }) {
  return (
    <div className="theme-background" aria-hidden="true">
      <div className="theme-background-layer theme-background-default" data-visible={theme === 'default'} />
      <div className="theme-background-layer theme-background-shopee" data-visible={theme === 'shopee'} />
      <div className="theme-background-layer theme-background-pharmcare" data-visible={theme === 'pharmcare'} />
    </div>
  );
}
