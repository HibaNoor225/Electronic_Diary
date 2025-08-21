// api.js
export async function fetchCategories() {
  const res = await fetch('http://localhost:3000/api/all/categories'); 
  const data = await res.json();
  return data.success ? data.data : [];
}

export async function fetchMoods() {
  const res = await fetch('http://localhost:3000/api/all/moods');
  const data = await res.json();
  return data.success ? data.data : [];
}
