from app.extensions import db

class SportCategory(db.Model):
    __tablename__ = "sport_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False, unique=True)
    purpose = db.Column(db.String(120), nullable=False, default="?뚰듃??紐⑥쭛")
    sports = db.relationship("Sport", back_populates="category", cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "purpose": self.purpose}

class Sport(db.Model):
    __tablename__ = "sports"

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("sport_categories.id"), nullable=False)
    name = db.Column(db.String(80), nullable=False)

    category = db.relationship("SportCategory", back_populates="sports")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "category_id": self.category_id, "category": self.category.to_dict()}

class Region(db.Model):
    __tablename__ = "regions"
    __table_args__ = (db.UniqueConstraint("code", name="uq_regions_code"),)

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), nullable=False, index=True)
    name = db.Column(db.String(80), nullable=False)
    level = db.Column(db.String(20), nullable=False)
    parent_code = db.Column(db.String(20), db.ForeignKey("regions.code"))
    full_name = db.Column(db.String(160), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

    parent = db.relationship("Region", remote_side=[code])

    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "level": self.level,
            "parent_code": self.parent_code,
            "full_name": self.full_name,
            "latitude": self.latitude,
            "longitude": self.longitude
        }

