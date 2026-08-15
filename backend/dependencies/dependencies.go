package dependencies

import (
	"encoding/json"
	"os"
	"sync"
)

type Dependency struct {
	From string `json:"from"` // service name that depends on another
	To   string `json:"to"`   // service name being depended upon
}

type Store struct {
	mu           sync.RWMutex
	deps         []Dependency
	dataPath     string
	onChange     func()
}

func New(dataPath string, onChange func()) *Store {
	s := &Store{
		dataPath: dataPath,
		onChange: onChange,
	}
	s.load()
	return s
}

func (s *Store) load() {
	data, err := os.ReadFile(s.dataPath)
	if err != nil {
		s.deps = []Dependency{}
		return
	}
	json.Unmarshal(data, &s.deps)
	if s.deps == nil {
		s.deps = []Dependency{}
	}
}

func (s *Store) save() error {
	data, err := json.MarshalIndent(s.deps, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.dataPath, data, 0644)
}

func (s *Store) GetAll() []Dependency {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Dependency, len(s.deps))
	copy(result, s.deps)
	return result
}

func (s *Store) Add(dep Dependency) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check for duplicates
	for _, d := range s.deps {
		if d.From == dep.From && d.To == dep.To {
			return nil // already exists
		}
	}

	// Prevent self-dependency
	if dep.From == dep.To {
		return &DependencyError{"service cannot depend on itself"}
	}

	// Check for circular dependency
	if s.wouldCreateCycle(dep.From, dep.To) {
		return &DependencyError{"adding this dependency would create a cycle"}
	}

	s.deps = append(s.deps, dep)
	if err := s.save(); err != nil {
		return err
	}
	if s.onChange != nil {
		s.onChange()
	}
	return nil
}

func (s *Store) Remove(from, to string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, d := range s.deps {
		if d.From == from && d.To == to {
			s.deps = append(s.deps[:i], s.deps[i+1:]...)
			if err := s.save(); err != nil {
				return err
			}
			if s.onChange != nil {
				s.onChange()
			}
			return nil
		}
	}
	return &DependencyError{"dependency not found"}
}

func (s *Store) wouldCreateCycle(from, to string) bool {
	// Build adjacency list
	adj := make(map[string][]string)
	for _, d := range s.deps {
		adj[d.From] = append(adj[d.From], d.To)
	}
	// Add the proposed edge
	adj[from] = append(adj[from], to)

	// DFS to detect cycle
	visited := make(map[string]bool)
	recStack := make(map[string]bool)

	var dfs func(node string) bool
	dfs = func(node string) bool {
		visited[node] = true
		recStack[node] = true

		for _, neighbor := range adj[node] {
			if !visited[neighbor] {
				if dfs(neighbor) {
					return true
				}
			} else if recStack[neighbor] {
				return true
			}
		}

		recStack[node] = false
		return false
	}

	for node := range adj {
		if !visited[node] {
			if dfs(node) {
				return true
			}
		}
	}
	return false
}

func (s *Store) GetDependents(service string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []string
	for _, d := range s.deps {
		if d.To == service {
			result = append(result, d.From)
		}
	}
	return result
}

func (s *Store) GetDependencies(service string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []string
	for _, d := range s.deps {
		if d.From == service {
			result = append(result, d.To)
		}
	}
	return result
}

type DependencyError struct {
	msg string
}

func (e *DependencyError) Error() string {
	return e.msg
}