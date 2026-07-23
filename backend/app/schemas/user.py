from marshmallow import Schema, fields


class UserProfileSchema(Schema):
    region = fields.Str()
    bio = fields.Str()
    exercise_level = fields.Str()
    preferred_sports = fields.Str()
    rating_average = fields.Float()
    attendance_rate = fields.Int()


class PublicUserSchema(Schema):
    id = fields.Int(dump_only=True)
    nickname = fields.Str()
    user_tag = fields.Str()
    profile_image_url = fields.Str()
    role = fields.Str()
    is_active = fields.Bool()
    status = fields.Str()
    profile = fields.Nested(UserProfileSchema)


class PrivateUserSchema(PublicUserSchema):
    auth_user_id = fields.Str()
    email = fields.Email()
    name = fields.Str()
    phone_number = fields.Str()
    provider = fields.Str()
    created_at = fields.DateTime()
