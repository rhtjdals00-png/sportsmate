import { MapPin } from "lucide-react";

function StaticMapCard({ meeting }) {
  return (
    <section className="map-card">
      <div className="map-card__canvas">
        <MapPin size={32} />
        <span>{meeting.location_name}</span>
      </div>
      <p>{meeting.address}</p>
    </section>
  );
}

export default StaticMapCard;

