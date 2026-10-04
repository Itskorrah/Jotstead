export default function NotFound() {
  return (
    <main className="loading-screen">
      <img src="/icons/icon-192.png" width={56} height={56} alt="Jotstead" />
      <h2>This page isn’t available.</h2>
      <p>It may be private, unpublished, or moved to Trash.</p>
      <a href="/">Open your workspace</a>
    </main>
  );
}
