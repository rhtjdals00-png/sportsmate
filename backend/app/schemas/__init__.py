from marshmallow import Schema, fields, validate


class RegisterSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=8))
    nickname = fields.String(required=True, validate=validate.Length(min=2, max=40))


class MeetingCreateSchema(Schema):
    sport_id = fields.Integer(required=True)
    title = fields.String(required=True, validate=validate.Length(min=2, max=160))
    description = fields.String(required=True)
    meeting_type = fields.String(validate=validate.OneOf(["one_time", "regular"]))
    location_name = fields.String(required=True)
    address = fields.String(required=True)
    start_at = fields.String(required=True)
    max_participants = fields.Integer(validate=validate.Range(min=2, max=50))

