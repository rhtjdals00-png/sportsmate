import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";

function PlaceholderPage({ title, description }) {
  return (
    <>
      <MobileHeader title={title} />
      <section className="placeholder-page">
        <strong>{title}</strong>
        <p>{description}</p>
      </section>
    </>
  );
}

export default PlaceholderPage;

