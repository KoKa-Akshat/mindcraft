# MindCraft Bookworld dashboard prototype

An isolated, clickable design study for turning book creation into a learning game.
It does not modify the production dashboard.

Run from the repository root so the prototype can load the existing Three.js
package and MindCraft art:

```bash
python3 -m http.server 8894
```

Open:

```text
http://127.0.0.1:8894/agent_work/product/bookworld_dashboard_prototype/
```

Core loop: question, model, make, explain, publish. Rewards are visible book
progress, evidence, collaboration, and a real published artifact rather than
points detached from learning.
