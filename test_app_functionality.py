import requests
import time
import sys

BASE_URL = "https://spiritcore-backend-production.up.railway.app"

def test_health():
    print("--- Testing Health ---")
    try:
        res = requests.get(f"{BASE_URL}/v1/admin/stats")
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            print(f"Stats: {res.json()}")
            return True
        return False
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_assets():
    print("\n--- Testing Assets ---")
    assets = [
        "/app/app.js",
        "/app/styles.css",
        "/videos/welcome_intro.mp4",
        "/portraits/lyra_portrait.png"
    ]
    all_ok = True
    for asset in assets:
        try:
            res = requests.head(f"{BASE_URL}{asset}")
            print(f"Asset {asset}: {res.status_code}")
            if res.status_code != 200:
                all_ok = False
        except Exception as e:
            print(f"Asset check failed for {asset}: {e}")
            all_ok = False
    return all_ok

def test_messaging_flow(spiritkin_name="Lyra"):
    print(f"\n--- Testing Messaging Flow for {spiritkin_name} ---")
    try:
        # 1. Create conversation
        res = requests.post(f"{BASE_URL}/v1/conversations", json={
            "userId": "test-user-123",
            "spiritkinName": spiritkin_name,
            "title": f"Test with {spiritkin_name}"
        })
        if res.status_code != 200:
            print(f"Failed to create conversation: {res.text}")
            return False
        data = res.json()
        conv = data["conversation"]
        conv_id = conv["conversation_id"]
        user_id = conv["user_id"]
        print(f"Created conversation: {conv_id} for user: {user_id}")

        # 2. Interact
        messages = [
            "Hello, who are you?",
            "I've been feeling a bit overwhelmed lately.",
            "Tell me about your world."
        ]
        
        for msg in messages:
            print(f"User: {msg}")
            res = requests.post(f"{BASE_URL}/v1/interact", json={
                "userId": user_id,
                "input": msg,
                "spiritkin": {"name": spiritkin_name},
                "conversationId": conv_id
            })
            if res.status_code != 200:
                print(f"Interact failed: {res.status_code}")
                return False
            data = res.json()
            reply = data["message"]
            print(f"{spiritkin_name}: {reply}")
            
            # Check for repetitive patterns
            forbidden = ["I am with you", "I am here with you", "I am here"]
            for f in forbidden:
                if f.lower() in reply.lower() and len(reply) < 100:
                    print(f"WARNING: Potential repetitive pattern detected: '{f}'")

        # 3. Verify in Admin
        time.sleep(1) # Small delay for persistence
        res = requests.get(f"{BASE_URL}/v1/admin/messages/{conv_id}")
        if res.status_code == 200:
            messages_data = res.json().get("messages", [])
            print(f"Admin verified: {len(messages_data)} messages in transcript.")
            return len(messages_data) >= 1
        return False
    except Exception as e:
        print(f"Messaging test failed: {e}")
        return False

def test_generator():
    print("\n--- Testing Premium Generator ---")
    try:
        payload = {
            "userName": "Test Seeker",
            "answers": {
                "q_support": "quiet listener",
                "q_world": "cosmic wonder",
                "q_strength": "deep empathy",
                "q_shadow": "seeking purpose",
                "q_form": "celestial being",
                "q_rhythm": "slow and deep",
                "q_gift": "creative expansion"
            }
        }
        res = requests.post(f"{BASE_URL}/v1/spiritkin/generate", json=payload)
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            if data.get("ok") and "spiritkin" in data:
                sk = data["spiritkin"]
                print(f"Generated Spiritkin: {sk.get('name')} - {sk.get('archetype')}")
                return True
        print(f"Generator Failed: {res.text}")
        return False
    except Exception as e:
        print(f"Generator test failed: {e}")
        return False

if __name__ == "__main__":
    success = True
    if not test_health(): success = False
    if not test_assets(): success = False
    
    # Test all three canonical Spiritkins
    for name in ["Lyra", "Raien", "Kairo"]:
        if not test_messaging_flow(name): success = False
        
    if not test_generator(): success = False
    
    if success:
        print("\nALL TESTS PASSED")
        sys.exit(0)
    else:
        print("\nTESTS FAILED")
        sys.exit(1)
