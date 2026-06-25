from flask import jsonify


def error_response(message, status=400):
    return jsonify({"message": message}), status

