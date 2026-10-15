import urllib.request, json

query = """
query {
  football {
    player(slug: "lionel-messi") {
      displayName
      activeClub { name }
      cards(first: 5) {
        nodes {
          slug
          pictureUrl
          rarity
          season { name }
        }
      }
    }
  }
}
"""
req = urllib.request.Request(
    "https://api.sorare.com/graphql",
    data=json.dumps({"query": query}).encode(),
    headers={"User-Agent": "CardDex/1.0", "Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        print(r.read().decode())
except urllib.error.HTTPError as e:
    print(e.read().decode())
