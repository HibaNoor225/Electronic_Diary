// api.js
export async function fetchCategories() {
  const res = await fetch('http://localhost:3000/api/categories'); 
  const data = await res.json();
  return data.success ? data.data : [];
}

export async function fetchMoods() {
  const res = await fetch('http://localhost:3000/api/moods');
  const data = await res.json();
  return data.success ? data.data : [];
}
