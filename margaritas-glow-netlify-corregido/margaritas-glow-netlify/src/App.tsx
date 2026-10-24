import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { StoreSettingsProvider } from './context/StoreSettingsContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { FAQPage, PolicyPage } from './pages/ContentPages';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return <BrowserRouter><StoreSettingsProvider><CartProvider><ScrollToTop/><div className="app-shell"><Header/><Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/catalogo" element={<CatalogPage/>}/>
    <Route path="/producto/:slug" element={<ProductPage/>}/>
    <Route path="/carrito" element={<CartPage/>}/>
    <Route path="/checkout" element={<CheckoutPage/>}/>
    <Route path="/pedido-confirmado" element={<OrderConfirmationPage/>}/>
    <Route path="/preguntas-frecuentes" element={<FAQPage/>}/>
    <Route path="/privacidad" element={<PolicyPage kind="privacidad"/>}/>
    <Route path="/condiciones" element={<PolicyPage kind="condiciones"/>}/>
    <Route path="/cambios-y-devoluciones" element={<PolicyPage kind="cambios"/>}/>
    <Route path="/admin" element={<AdminPage/>}/>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes><Footer/></div></CartProvider></StoreSettingsProvider></BrowserRouter>;
}
