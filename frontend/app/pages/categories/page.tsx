import { redirect } from 'next/navigation';

export default function CategoriesIndex() {
  redirect('/pages/categories/smartphones');  // or '/categories/smartphones' after Option B
}