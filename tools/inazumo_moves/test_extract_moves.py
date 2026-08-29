import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("extract_moves.py")
spec = importlib.util.spec_from_file_location("extract_moves", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ParseMoveTests(unittest.TestCase):
    def test_parses_catalog_card(self):
        card = {
            "sourceUrl": "https://inazumo.es/tecnicas/god-hand",
            "lines": ["MANO CELESTIAL", "God Hand", "Potencia", "60", "Tensión", "60"],
            "headings": ["MANO CELESTIAL"],
            "imageAlts": ["Parada"],
        }
        move = module.parse_card_payload(card)
        self.assertEqual(move["moveId"], "god-hand")
        self.assertEqual(move["name"], "God Hand")
        self.assertEqual(move["sourceNameEs"], "MANO CELESTIAL")
        self.assertEqual(move["type"], "save")
        self.assertEqual(move["power"], 60)
        self.assertEqual(move["tension"], 60)

    def test_translates_element_and_type(self):
        self.assertEqual(module._find_type("Image: Defensa"), ("defense", "Defensa"))
        self.assertEqual(module._find_element("Montaña"), ("Mountain", "Montaña"))
        self.assertEqual(module._find_element("Bosque"), ("Forest", "Bosque"))

    def test_keeps_known_flags(self):
        card = {
            "sourceUrl": "https://inazumo.es/tecnicas/inazuma-drop",
            "lines": [
                "TRAMPOLÍN RELÁMPAGO",
                "Inazuma Drop",
                "Potencia",
                "70",
                "Tensión",
                "70",
                "Contrataque",
            ],
            "headings": ["TRAMPOLÍN RELÁMPAGO"],
            "imageAlts": ["Tiro"],
        }
        move = module.parse_card_payload(card)
        self.assertEqual(move["flags"], ["counterattack"])
        self.assertEqual(move["type"], "shot")

    def test_collision_gets_stable_suffix(self):
        moves = [
            {
                "moveId": "same",
                "name": "Move A",
                "sourceNameEs": "A",
                "type": "shot",
                "power": 50,
                "sourceUrl": "https://inazumo.es/tecnicas/same-a",
            },
            {
                "moveId": "same",
                "name": "Move B",
                "sourceNameEs": "B",
                "type": "save",
                "power": 60,
                "sourceUrl": "https://inazumo.es/tecnicas/same-b",
            },
        ]
        stable = module._dedupe_and_stabilize(moves)
        ids = {move["moveId"] for move in stable}
        self.assertEqual(len(ids), 2)
        self.assertIn("same", ids)
        self.assertTrue(any(move_id.startswith("same-") for move_id in ids if move_id != "same"))


if __name__ == "__main__":
    unittest.main()
