package dependencies

import (
	"os"
	"testing"
)

func TestDependencyStore(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "deps_test_*.json")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	store := New(tmpFile.Name(), nil)

	// Test Add
	err = store.Add(Dependency{From: "api", To: "db"})
	if err != nil {
		t.Fatalf("Add failed: %v", err)
	}

	deps := store.GetAll()
	if len(deps) != 1 || deps[0].From != "api" || deps[0].To != "db" {
		t.Fatalf("Expected 1 dependency, got %v", deps)
	}

	// Test duplicate add (should be idempotent)
	err = store.Add(Dependency{From: "api", To: "db"})
	if err != nil {
		t.Fatalf("Duplicate add should be idempotent: %v", err)
	}

	// Test self-dependency error
	err = store.Add(Dependency{From: "api", To: "api"})
	if err == nil {
		t.Fatal("Self-dependency should error")
	}

	// Test cycle detection
	err = store.Add(Dependency{From: "db", To: "cache"})
	if err != nil {
		t.Fatalf("Add db->cache failed: %v", err)
	}
	
	// This would create cycle: api -> db -> cache -> api
	err = store.Add(Dependency{From: "cache", To: "api"})
	if err == nil {
		t.Fatal("Cycle should be detected")
	}

	// Test GetDependents and GetDependencies
	dependents := store.GetDependents("db")
	if len(dependents) != 1 || dependents[0] != "api" {
		t.Fatalf("Expected dependents of db to be [api], got %v", dependents)
	}

	dependencies := store.GetDependencies("api")
	if len(dependencies) != 1 || dependencies[0] != "db" {
		t.Fatalf("Expected dependencies of api to be [db], got %v", dependencies)
	}

	// Test Remove
	err = store.Remove("api", "db")
	if err != nil {
		t.Fatalf("Remove failed: %v", err)
	}
	deps = store.GetAll()
	if len(deps) != 1 || deps[0].From != "db" || deps[0].To != "cache" {
		t.Fatalf("Expected 1 dependency (db->cache) after remove, got %v", deps)
	}

	// Test Remove non-existent
	err = store.Remove("nonexistent", "target")
	if err == nil {
		t.Fatal("Remove non-existent should error")
	}
}

func TestDependencyStorePersistence(t *testing.T) {
	tmpFile, err := os.CreateTemp("", "deps_persist_*.json")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Create store, add deps
	store1 := New(tmpFile.Name(), nil)
	store1.Add(Dependency{From: "api", To: "db"})
	store1.Add(Dependency{From: "worker", To: "queue"})

	// Create new store from same file
	store2 := New(tmpFile.Name(), nil)
	deps := store2.GetAll()
	if len(deps) != 2 {
		t.Fatalf("Expected 2 persisted dependencies, got %d", len(deps))
	}
}