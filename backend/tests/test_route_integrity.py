import unittest
from collections import Counter

from app import create_app


class RouteIntegrityTests(unittest.TestCase):
    def test_http_method_and_rule_pairs_are_unique(self):
        app = create_app()
        route_pairs = [
            (str(rule.rule), method)
            for rule in app.url_map.iter_rules()
            for method in rule.methods - {"HEAD", "OPTIONS"}
        ]
        duplicates = [pair for pair, count in Counter(route_pairs).items() if count > 1]

        self.assertEqual(duplicates, [])


if __name__ == "__main__":
    unittest.main()
