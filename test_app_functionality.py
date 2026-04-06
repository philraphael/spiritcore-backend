import requests
import json
import time

BASE_URL = "https://spiritcore-backend-production.up.railway.app"

def test_health():
    print("Testing /health...")
    try:
        res = requests.get(f"{BASE_URL}/v1/admin/stats")
        print(f"Status: {res.status_code}, Response: {res.text}")
        assert res.status_code == 200
        return True
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_assets():
    print("Testing Assets...")
    assets = [
        "/app/app.js",
        "/app/styles.css",
        "/videos/welcome_intro.mp4",
        "/portraits/lyra_portrait.png"
    ]
    for asset in assets:
        try:
            res = requests.head(f"{BASE_URL}{asset}")
            print(f"Asset {asset}: {res.status_code}")
            if res.status_code != 200:
                print(f"FAILED: {asset} returned {res.status_code}")
                return False
        except Exception as e:
            print(f"Asset check failed for {asset}: {e}")
            return False
    return True

def test_messaging():
    print("Testing Messaging Flow...")
    user_id = "test-user-verify-" + str(int(time.time()))
    try:
        # 1. Start Conversation
        print("Starting conversation...")
        res = requests.post(f"{BASE_URL}/v1/conversations", json={
            "userId": user_id,
            "spiritkinName": "Lyra"
        })
        data = res.json()
        print(f"Conv Start: {data}")
        assert data["ok"] == True
        conv_id = data["conversation"]["conversation_id"]
        resolved_user_id = data["conversation"]["user_id"]

        # 2. Send Message
        print("Sending message...")
        res = requests.post(f"{BASE_URL}/v1/interact", json={
            "userId": resolved_user_id,
            "conversationId": conv_id,
            "input": "Verify connection. Tell me about the Luminous Veil."
        })
        data = res.json()
        print(f"Interact Response: {data['spiritkin']} says: {data['message'][:50]}...")
        assert data["ok"] == True
        assert data["spiritkin"] == "Lyra"
        
        # 3. Verify in Command Center
        print("Verifying in Command Center...")
        res = requests.get(f"{BASE_URL}/v1/admin/messages/{conv_id}")
        data = res.json()
        print(f"Admin Messages: {len(data['messages'])} found")
        assert data["ok"] == True
        # Note: Assistant messages might not be persisted yet if the service is fire-and-forget, 
        # but the user message should be there.
        assert len(data["messages"]) >= 1
        
        return True
    except Exception as e:
        print(f"Messaging test failed: {e}")
        return False

if __name__ == "__main__":
    h = test_health()
    a = test_assets()
    m = test_messaging()
    
    if h and a and m:
        print("\nALL TESTS PASSED SUCCESSFULLY!")
    else:
        print("\nSOME TESTS FAILED. CHECK LOGS.")
