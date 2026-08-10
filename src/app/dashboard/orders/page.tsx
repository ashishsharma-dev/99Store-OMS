'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  Star,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  Printer,
  Barcode,
  Send,
  Copy,
  MessageSquare,
  Trash2,
  Clock,
  ChevronDown,
  ArrowUpDown,
  Edit
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';
import { HealvitaShippingLabel } from '@/components/HealvitaShippingLabel';
import { InspectTooltipButton } from '@/components/InspectTooltipButton';
import { CourierLogo } from '@/components/CourierLogo';
import { AddressRatingIndicator } from '@/components/AddressRatingIndicator';
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter';
import { getUserDisplayName } from '@/lib/utils';

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'all',
    startDate: '',
    endDate: ''
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Printing label popup state
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [showPrintLabel, setShowPrintLabel] = useState(false);

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [phonePrimary, setPhonePrimary] = useState('');
  const [phoneSecondary, setPhoneSecondary] = useState('');
  const [phoneTertiary, setPhoneTertiary] = useState('');
  const [phoneWhatsApp, setPhoneWhatsApp] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [area, setArea] = useState('');
  const [productDetails, setProductDetails] = useState('');
  const [paymentType, setPaymentType] = useState<'COD' | 'Paid'>('Paid');
  const [orderValue, setOrderValue] = useState('');
  const [partiallyPaidAmount, setPartiallyPaidAmount] = useState('');
  const [weight, setWeight] = useState('0.2');
  const [internalRemarks, setInternalRemarks] = useState('');
  const [isVip, setIsVip] = useState(false);

  const [pincodeFetching, setPincodeFetching] = useState(false);
  const [pincodeSuccess, setPincodeSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Duplicate Check States
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [whatsAppSuccessModal, setWhatsAppSuccessModal] = useState<{ show: boolean; title: string; message: string; isError?: boolean }>({
    show: false,
    title: '',
    message: '',
    isError: false
  });
  const [whatsAppSelectModal, setWhatsAppSelectModal] = useState<{
    show: boolean;
    order: Order | null;
    selectedNumbers: string[];
    loading: boolean;
    sendingTemplate?: string;
    logsLoading: boolean;
    logs?: any[];
  }>({
    show: false,
    order: null,
    selectedNumbers: [],
    loading: false,
    logsLoading: false
  });

  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const WHATSAPP_TEMPLATES = [
    { key: 'Created', name: 'Order Confirmation', desc: 'Sent when the order is first registered.' },
    { key: 'Label Generated', name: 'Shipping Label', desc: 'Sent when the carrier AWB is generated.' },
    { key: 'Dispatched', name: 'Order Dispatched', desc: 'Sent when parcel leaves the warehouse.' },
    { key: 'RDC', name: 'Local Hub Arrival', desc: 'Sent when parcel reaches nearby RDC.' },
    { key: 'OFD', name: 'Out for Delivery', desc: 'Sent when delivery boy is dispatched.' },
    { key: 'Delivered', name: 'Delivered Confirmation', desc: 'Sent upon successful delivery.' },
    { key: 'NDR', name: 'Delivery Failed Attempt', desc: 'Sent when a delivery attempt fails.' },
    { key: 'Return', name: 'RTO Return Update', desc: 'Sent when parcel is returning to origin.' }
  ];

  useEffect(() => {
    if (!whatsAppSelectModal.show || !whatsAppSelectModal.logs || whatsAppSelectModal.logs.length === 0) {
      setCooldownSeconds(0);
      return;
    }

    const calculateCooldown = () => {
      const sentLogs = whatsAppSelectModal.logs!.filter(l => l.status === 'Sent' || l.status === 'Pending');
      if (sentLogs.length === 0) return 0;
      
      const timestamps = sentLogs.map(l => new Date(l.timestamp).getTime());
      const mostRecent = Math.max(...timestamps);
      const elapsed = Date.now() - mostRecent;
      const remaining = Math.max(0, 60000 - elapsed);
      return Math.ceil(remaining / 1000);
    };

    setCooldownSeconds(calculateCooldown());

    const timer = setInterval(() => {
      const remaining = calculateCooldown();
      setCooldownSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [whatsAppSelectModal.show, whatsAppSelectModal.logs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const cloneId = params.get('clone');
    if (cloneId) {
      // Clear the query parameter from the URL bar so it doesn't re-trigger on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      // Fetch the order to clone
      fetch(`/api/orders/${cloneId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.order) {
            const o = data.order;
            setCustomerName(o.customerName);
            setPhonePrimary(o.phonePrimary);
            setPhoneSecondary(o.phoneSecondary || '');
            setPhoneTertiary(o.phoneTertiary || '');
            setAddress(o.address);
            setPincode(o.pincode);
            setState(o.state);
            setArea(o.area);
            setProductDetails(o.productDetails);
            setPaymentType(o.paymentType);
            setOrderValue((o.orderValue || 0).toString());
            setPartiallyPaidAmount((o.partiallyPaidAmount || 0).toString());
            setWeight((o.weight || 0).toString());
            setInternalRemarks(o.internalRemarks || '');
            setIsVip(o.isVip);
            setShowAddModal(true);
          }
        })
        .catch(err => console.error('Failed to clone order:', err));
    }
  }, []);

  const handleWhatsAppClick = async (order: Order) => {
    const defaultSelected: string[] = [];
    if (order.phonePrimary) defaultSelected.push(order.phonePrimary.trim());
    if (order.phoneWhatsApp) defaultSelected.push(order.phoneWhatsApp.trim());
    
    const uniqueDefaults = Array.from(new Set(defaultSelected)).filter(Boolean);

    setWhatsAppSelectModal({
      show: true,
      order,
      selectedNumbers: uniqueDefaults,
      loading: false,
      logsLoading: true,
      logs: []
    });

    try {
      const res = await fetch(`/api/orders/${order.id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setWhatsAppSelectModal(prev => ({
          ...prev,
          logs: data.logs || [],
          logsLoading: false
        }));
      } else {
        setWhatsAppSelectModal(prev => ({ ...prev, logsLoading: false }));
      }
    } catch (err) {
      console.error('Failed to load order logs:', err);
      setWhatsAppSelectModal(prev => ({ ...prev, logsLoading: false }));
    }
  };

  const handleTriggerWhatsAppSend = async (templateKey: string) => {
    const { order, selectedNumbers } = whatsAppSelectModal;
    if (!order) return;
    if (selectedNumbers.length === 0) {
      alert('Please select at least one number to send the WhatsApp notification to.');
      return;
    }

    setWhatsAppSelectModal(prev => ({ ...prev, loading: true, sendingTemplate: templateKey }));

    try {
      const res = await fetch(`/api/orders/${order.id}/whatsapp-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetNumbers: selectedNumbers, template: templateKey })
      });
      const data = await res.json();
      
      if (res.ok) {
        // Re-fetch order details to update logs
        const freshRes = await fetch(`/api/orders/${order.id}`);
        const freshData = await freshRes.json();
        
        setWhatsAppSelectModal(prev => ({
          ...prev,
          loading: false,
          sendingTemplate: undefined,
          logs: freshData.logs || prev.logs
        }));

        setWhatsAppSuccessModal({
          show: true,
          title: 'Notification Dispatched',
          message: `On-Demand WhatsApp notification for template "${templateKey}" successfully queued and sent to selected numbers.`
        });
      } else {
        setWhatsAppSelectModal(prev => ({ ...prev, loading: false, sendingTemplate: undefined }));
        setWhatsAppSuccessModal({
          show: true,
          title: 'Dispatch Failed',
          message: data.error || 'Failed to send WhatsApp update.',
          isError: true
        });
      }
    } catch (err) {
      setWhatsAppSelectModal(prev => ({ ...prev, loading: false, sendingTemplate: undefined }));
      setWhatsAppSuccessModal({
        show: true,
        title: 'Connection Error',
        message: 'Failed to connect to the WhatsApp dispatch API.',
        isError: true
      });
    }
  };

  const handleToggleVip = async (order: Order) => {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isVip: !order.isVip,
          updatedBy: currentUser?.username || 'admin'
        })
      });

      if (res.ok) {
        fetchOrdersList();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update VIP status.');
      }
    } catch (err) {
      console.error('Error toggling VIP status:', err);
    }
  };

  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [vipFilter, setVipFilter] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selection & Deletion States
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const handleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOrders = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map(o => o.id));
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!currentUser) return;
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Order Team') {
      alert(`Role '${currentUser.role}' is not authorized to delete orders.`);
      return;
    }
    if (currentUser.role === 'Order Team' && order.status !== 'Created') {
      alert(`Order Team members can only delete orders in Created status.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Order #${order.orderId}? This action requires role authorization.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/orders/${order.id}?deletedBy=${currentUser.username}&role=${currentUser.role}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchOrdersList();
      } else {
        alert(data.error || 'Failed to delete order.');
      }
    } catch (err) {
      alert('Network error deleting order.');
    }
  };

  const handleBulkDeleteOrders = async () => {
    if (!currentUser || selectedOrderIds.length === 0) return;
    if (currentUser.role !== 'Super Admin' && currentUser.role !== 'Order Team') {
      alert(`Role '${currentUser.role}' is not authorized to bulk delete orders.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedOrderIds.length} selected orders?`)) {
      return;
    }
    try {
      const res = await fetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          deletedBy: currentUser.username,
          role: currentUser.role
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedOrderIds([]);
        fetchOrdersList();
      } else {
        alert(data.error || 'Failed bulk deletion.');
      }
    } catch (err) {
      alert('Network error executing bulk deletion.');
    }
  };

  // Current session user and default contact variables from settings
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [defaultPrimaryPhone, setDefaultPrimaryPhone] = useState('+91 9876543210');
  const [defaultSecondaryPhone, setDefaultSecondaryPhone] = useState('+91 9123456789');

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }

    // Fetch prefilled primary and secondary contact variables from settings
    const fetchSettingsContacts = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (res.ok && data.settings) {
          const prim = data.settings.primaryContactNumbers?.[0] || '+91 9876543210';
          const sec = data.settings.secondaryContactNumbers?.[0] || '+91 9123456789';
          setDefaultPrimaryPhone(prim);
          setDefaultSecondaryPhone(sec);
          setPhonePrimary(prim);
          setPhoneSecondary(sec);
        }
      } catch (err) {
        console.error('Failed to fetch settings contact variables:', err);
      }
    };
    fetchSettingsContacts();
  }, []);

  useEffect(() => {
    fetchOrdersList();
  }, [search, statusFilter, paymentFilter, vipFilter, sortField, sortOrder, page, limit, dateRange]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrdersList(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [search, statusFilter, paymentFilter, vipFilter, sortField, sortOrder, page, limit, dateRange]);

  // Autofetch State/Area via Pincode API when 6 digits are typed
  useEffect(() => {
    if (pincode.length === 6 && /^\d+$/.test(pincode)) {
      fetchPincodeData(pincode);
    } else {
      setPincodeSuccess(false);
    }
  }, [pincode]);

  const fetchPincodeData = async (pin: string) => {
    setPincodeFetching(true);
    try {
      const res = await fetch(`/api/integrations/pincode?pincode=${pin}`);
      const data = await res.json();
      setPincodeFetching(false);
      if (res.ok && data.state) {
        setState(data.state);
        setArea(data.area);
        setPincodeSuccess(true);
      }
    } catch (err) {
      setPincodeFetching(false);
      console.error('Failed to fetch pincode:', err);
    }
  };

  const fetchOrdersList = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      let url = `/api/orders?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${statusFilter}&payment=${paymentFilter}&vip=${vipFilter}&sortField=${sortField}&sortOrder=${sortOrder}`;
      if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
      if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.totalCount || 0);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const executeOrderCreation = async () => {
    setFormLoading(true);
    setFormError('');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          phonePrimary,
          phoneSecondary,
          phoneTertiary,
          phoneWhatsApp,
          address,
          pincode,
          state,
          area,
          productDetails,
          paymentType,
          orderValue: parseFloat(orderValue),
          weight: parseFloat(weight),
          internalRemarks,
          isVip,
          createdBy: currentUser?.username || 'admin',
          partiallyPaidAmount: partiallyPaidAmount ? parseFloat(partiallyPaidAmount) : 0
        })
      });

      const data = await res.json();
      setFormLoading(false);

      if (!res.ok) {
        setFormError(data.error || 'Failed to create order.');
        return;
      }

      // Reset Form and refresh
      setShowAddModal(false);
      setShowDuplicateModal(false);
      resetForm();
      fetchOrdersList();
    } catch (err) {
      setFormLoading(false);
      setFormError('Network connection failure.');
    }
  };

  const executeOrderEdit = async () => {
    setFormLoading(true);
    setFormError('');
    try {
      const res = await fetch(`/api/orders/${editingOrderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          phonePrimary,
          phoneSecondary,
          phoneTertiary,
          phoneWhatsApp,
          address,
          pincode,
          state,
          area,
          productDetails,
          paymentType,
          orderValue: parseFloat(orderValue),
          weight: parseFloat(weight),
          internalRemarks,
          isVip,
          updatedBy: currentUser?.username || 'admin',
          partiallyPaidAmount: partiallyPaidAmount ? parseFloat(partiallyPaidAmount) : 0,
          role: currentUser?.role || ''
        })
      });

      const data = await res.json();
      setFormLoading(false);

      if (!res.ok) {
        setFormError(data.error || 'Failed to update order.');
        return;
      }

      // Reset Form and refresh
      setShowAddModal(false);
      resetForm();
      fetchOrdersList();
    } catch (err) {
      setFormLoading(false);
      setFormError('Network connection failure.');
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customerName || !phonePrimary || !address || !pincode || !productDetails || !orderValue || !weight) {
      setFormError('Please enter all required fields.');
      return;
    }

    const val = parseFloat(orderValue);
    const paid = partiallyPaidAmount ? parseFloat(partiallyPaidAmount) : 0;

    if (val <= 0) {
      setFormError('Order Value must be greater than 0.');
      return;
    }

    if (paymentType === 'Paid') {
      if (paid > 0) {
        setFormError('For prepaid (Paid) orders, the partially paid amount must be 0 (the full amount is already paid).');
        return;
      }
    } else if (paymentType === 'COD') {
      if (paid < 0) {
        setFormError('Partially paid amount cannot be negative.');
        return;
      }
      if (paid >= val) {
        setFormError('For COD orders, the partially paid amount must be less than the total order value. If it is fully paid, please select Prepaid (Paid).');
        return;
      }
    }

    if (isEditMode) {
      await executeOrderEdit();
      return;
    }

    setFormLoading(true);
    try {
      const checkRes = await fetch(
        `/api/orders/check-duplicate?phone=${encodeURIComponent(phoneTertiary)}&name=${encodeURIComponent(customerName)}&pincode=${encodeURIComponent(pincode)}&address=${encodeURIComponent(address)}`
      );
      const checkData = await checkRes.json();
      setFormLoading(false);

      if (checkRes.ok && checkData.isDuplicate) {
        setDuplicateMatches(checkData.matches);
        setShowDuplicateModal(true);
        return;
      }
    } catch (err) {
      console.error('Duplicate check failed, proceeding anyway:', err);
    }

    await executeOrderCreation();
  };

  const resetForm = () => {
    setCustomerName('');
    setPhonePrimary(defaultPrimaryPhone);
    setPhoneSecondary(defaultSecondaryPhone);
    setPhoneTertiary('');
    setPhoneWhatsApp('');
    setAddress('');
    setPincode('');
    setState('');
    setArea('');
    setProductDetails('');
    setPaymentType('Paid');
    setOrderValue('');
    setPartiallyPaidAmount('');
    setWeight('0.2');
    setInternalRemarks('');
    setIsVip(false);
    setFormError('');
    setIsEditMode(false);
    setEditingOrderId(null);
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);

    if (order.awb) {
      const courierParam = order.courier ? `&courier=${order.courier}` : '';
      fetch(`/api/integrations/courier?action=track&waybill=${order.awb}${courierParam}`)
        .then(res => {
          if (res.ok) {
            fetchOrdersList(true);
            return fetch(`/api/orders/${order.id}`);
          }
        })
        .then(res => res?.json())
        .then(data => {
          if (data && data.success && data.order) {
            setSelectedOrder(data.order);
          }
        })
        .catch(err => console.error('Failed to trigger single parcel sync:', err));
    }
  };

  const handleCloneOrder = (order: Order) => {
    setCustomerName(order.customerName);
    setPhonePrimary(order.phonePrimary);
    setPhoneSecondary(order.phoneSecondary || '');
    setPhoneTertiary(order.phoneTertiary || '');
    setAddress(order.address);
    setPincode(order.pincode);
    setState(order.state);
    setArea(order.area);
    setProductDetails(order.productDetails);
    setPaymentType(order.paymentType);
    setOrderValue((order.orderValue || 0).toString());
    setPartiallyPaidAmount((order.partiallyPaidAmount || 0).toString());
    setWeight((order.weight || 0).toString());
    setInternalRemarks(order.internalRemarks || '');
    setIsVip(order.isVip);
    setShowAddModal(true);
  };

  const handleEditClick = (order: Order) => {
    setIsEditMode(true);
    setEditingOrderId(order.id);
    
    setCustomerName(order.customerName);
    setPhonePrimary(order.phonePrimary);
    setPhoneSecondary(order.phoneSecondary || '');
    setPhoneTertiary(order.phoneTertiary || '');
    setPhoneWhatsApp(order.phoneWhatsApp || '');
    setAddress(order.address);
    setPincode(order.pincode);
    setState(order.state);
    setArea(order.area);
    setProductDetails(order.productDetails);
    setPaymentType(order.paymentType);
    setOrderValue((order.orderValue || 0).toString());
    setPartiallyPaidAmount((order.partiallyPaidAmount || 0).toString());
    setWeight((order.weight || 0).toString());
    setInternalRemarks(order.internalRemarks || '');
    setIsVip(order.isVip);
    
    setShowAddModal(true);
  };

  const handleExportCsv = () => {
    let url = `/api/reports?status=${statusFilter}&payment=${paymentFilter}&vip=${vipFilter}`;
    if (search.trim() !== '') url += `&search=${encodeURIComponent(search)}`;
    if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
    if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
    window.open(url);
  };

  const handleSortChange = (combinedValue: string) => {
    const [field, order] = combinedValue.split('-');
    setSortField(field);
    setSortOrder(order);
    setPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setPaymentFilter('all');
    setVipFilter('all');
    setPage(1);
  };

  const handlePrintLabel = (order: Order) => {
    setPrintingOrder(order);
    setShowPrintLabel(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>Manual Order Management</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Manual order additions, bulk filters sorting and reports download.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DateRangeFilter value={dateRange} onChange={(range) => { setDateRange(range); setPage(1); }} />
          <button onClick={handleExportCsv} className="premium-btn premium-btn-secondary">
            <Download size={14} />
            <span>Download CSV (Filtered)</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="premium-btn premium-btn-primary">
            <Plus size={14} />
            <span>Create Manual Order</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar Card */}
      <div
        className="premium-card"
        style={{
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          backgroundColor: '#09090B',
          borderColor: '#27272A',
          minHeight: '50px'
        }}
      >
        {/* Global Search */}
        <div style={{ position: 'relative', minWidth: '240px', maxWidth: '300px', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#737373' }} />
          <input
            type="text"
            className="premium-input"
            style={{
              paddingLeft: '32px',
              height: '34px',
              fontSize: '13px',
              backgroundColor: '#18181B',
              borderColor: '#27272A'
            }}
            placeholder="Search: Name, Phone, Order ID, AWB, Address..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Filter size={14} style={{ color: '#737373', flexShrink: 0 }} />

        {/* Filter Status */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{
              width: 'auto',
              minWidth: '120px',
              padding: '6px 28px 6px 12px',
              height: '34px',
              fontSize: '13px',
              backgroundColor: '#18181B',
              borderColor: '#27272A',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none'
            }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Status (All)</option>
            <option value="Created">Created</option>
            <option value="Packing">Packing</option>
            <option value="Courier Selected">Courier Selected</option>
            <option value="Label Generated">Label Generated</option>
            <option value="Dispatched">Dispatched</option>
            <option value="OFD">OFD (Out for Delivery)</option>
            <option value="Delivered">Delivered</option>
            <option value="Undelivered">Undelivered</option>
            <option value="Return">Returned</option>
            <option value="RDC">RDC Update</option>
            <option value="NDR">NDR Failure</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        {/* Filter Payment */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{
              width: 'auto',
              minWidth: '120px',
              padding: '6px 28px 6px 12px',
              height: '34px',
              fontSize: '13px',
              backgroundColor: '#18181B',
              borderColor: '#27272A',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none'
            }}
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Payment (All)</option>
            <option value="Paid">Prepaid (Paid)</option>
            <option value="COD">Cash on Delivery (COD)</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        {/* Filter VIP */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{
              width: 'auto',
              minWidth: '120px',
              padding: '6px 28px 6px 12px',
              height: '34px',
              fontSize: '13px',
              backgroundColor: '#18181B',
              borderColor: '#27272A',
              appearance: 'none',
              cursor: 'pointer',
              outline: 'none'
            }}
            value={vipFilter}
            onChange={(e) => { setVipFilter(e.target.value); setPage(1); }}
          >
            <option value="all">VIP Tags (All)</option>
            <option value="true">⭐ VIP Only</option>
            <option value="false">Non-VIP</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        {/* Sort Select (Icon Only) */}
        <div
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 'auto',
            width: '34px',
            height: '34px',
            backgroundColor: '#18181B',
            border: '1px solid #27272A',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
          title="Sort Options"
        >
          <ArrowUpDown size={14} style={{ color: '#FAFAFA' }} />
          <select
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none'
            }}
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            <option value="createdAt-desc">Created Date: Descending</option>
            <option value="createdAt-asc">Created Date: Ascending</option>
            <option value="orderValue-desc">Order Value: High to Low</option>
            <option value="orderValue-asc">Order Value: Low to High</option>
            <option value="weight-desc">Package Weight: Heavy to Light</option>
            <option value="weight-asc">Package Weight: Light to Heavy</option>
          </select>
        </div>
      </div>

      {/* Main Table Listing */}
      {loading ? (
        <div className="premium-card loading-overlay" style={{ minHeight: '220px' }}>
          <span className="spinner spinner-lg spinner-accent" />
          <span>Retrieving order records...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
          No records match the active query. Try broadening your filter selections or search terms.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0 }}>
          {selectedOrderIds.length > 0 && (
            <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#F87171', fontWeight: 500 }}>
                {selectedOrderIds.length} order(s) selected for bulk action
              </span>
              <button
                onClick={handleBulkDeleteOrders}
                className="premium-btn premium-btn-danger"
                style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={14} />
                <span>Delete Selected ({selectedOrderIds.length})</span>
              </button>
            </div>
          )}
          <div className="premium-table-container" style={{ width: '100%', maxWidth: '100%', minWidth: 0, maxHeight: 'calc(100vh - 280px)', overflowX: 'auto', overflowY: 'auto' }}>
            <table className="premium-table" style={{ minWidth: '1420px', tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', padding: '0 8px' }}>
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                      onChange={handleSelectAllOrders}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ minWidth: '120px' }}>Order ID</th>
                  <th style={{ minWidth: '210px' }}>Customer Details</th>
                  <th style={{ minWidth: '230px' }}>Products</th>
                  <th style={{ minWidth: '120px' }}>Payment Type</th>
                  <th style={{ minWidth: '110px' }}>Order Value</th>
                  <th style={{ minWidth: '130px' }}>Status</th>
                  <th style={{ minWidth: '160px' }}>Tracking</th>
                  <th style={{ textAlign: 'right', minWidth: '210px', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const isOrderPaid = o.paymentType === 'Paid';
                  const isPartiallyPaid = o.partiallyPaidAmount !== undefined && o.partiallyPaidAmount > 0;

                  let borderLeftStyle = 'none';
                  let bgStyle = 'transparent';

                  if (isPartiallyPaid) {
                    borderLeftStyle = '3px solid #10B981';
                    bgStyle = 'rgba(16,185,129,0.08)';
                  } else if (isOrderPaid) {
                    borderLeftStyle = '3px solid var(--color-paid)';
                    bgStyle = 'rgba(16,185,129,0.01)';
                  }

                  return (
                    <tr
                      key={o.id}
                      style={{
                        borderLeft: borderLeftStyle,
                        backgroundColor: bgStyle
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(o.id)}
                          onChange={() => handleSelectOrder(o.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.orderId}</span>
                          {/* ⭐ VIP Indicator */}
                          {o.isVip && (
                            <span title="VIP Customer" style={{ color: 'var(--color-vip)', display: 'inline-flex' }}>
                              <Star size={12} fill="var(--color-vip)" />
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                          <span style={{ fontSize: '11px', color: '#737373' }}>{o.createdAt.split('T')[0]}</span>
                          {o.createdBy && (
                            <span style={{ fontSize: '10.5px', color: '#A1A1AA' }}>By: {getUserDisplayName(o.createdBy)}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                        <div style={{ fontSize: '11.5px', color: '#737373' }}>
                          {o.phonePrimary} | {o.area}, {o.state}
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.productDetails}
                        </div>
                        <span style={{ fontSize: '11px', color: '#737373' }}>Weight: {o.weight} kg</span>
                      </td>
                      <td>
                        {isPartiallyPaid ? (
                          <span className="premium-badge badge-partial">Partially Paid</span>
                        ) : (
                          <span className={`premium-badge ${isOrderPaid ? 'badge-paid' : 'badge-cod'}`}>
                            {o.paymentType}
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{o.orderValue.toFixed(2)}</td>
                      <td>
                        <span className={`premium-badge status-${o.status.toLowerCase().replace(' ', '')}`}>
                          {o.status}
                        </span>
                      </td>
                      <td>
                        {o.awb ? (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CourierLogo courier={o.courier} size={14} />
                            </div>
                            <div style={{ fontSize: '11px', color: '#737373', fontFamily: 'monospace' }}>{o.awb}</div>
                            {o.eta && (
                              <div style={{ fontSize: '11px', color: '#10B981', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} />
                                <span>EDT: {o.eta}</span>
                              </div>
                            )}
                            {o.current_status && (
                              <div style={{ fontSize: '10.5px', color: '#A1A1AA', marginTop: '2px' }}>
                                Status: {o.current_status}
                              </div>
                            )}
                            <button
                              onClick={() => handlePrintLabel(o)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#3B82F6',
                                fontSize: '11px',
                                padding: 0,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                marginTop: '2px'
                              }}
                              title="Print Shipping Label"
                            >
                              <Printer size={12} />
                              <span>Label</span>
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontSize: '11px', color: '#55555A' }}>AWB Pending</span>
                            {o.eta && (
                              <div style={{ fontSize: '11px', color: '#10B981', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} />
                                <span>EDT: {o.eta}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleWhatsAppClick(o)}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.08)' }}
                            title="Send On-Demand WhatsApp Alert"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleVip(o)}
                            className="premium-btn premium-btn-secondary"
                            style={{ 
                              padding: '6px 8px', 
                              fontSize: '12px', 
                              borderColor: 'rgba(16, 185, 129, 0.4)', 
                              color: '#10B981', 
                              backgroundColor: o.isVip ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.04)' 
                            }}
                            title={o.isVip ? "Remove VIP Status" : "Mark as VIP"}
                          >
                            <Star size={14} fill={o.isVip ? "#10B981" : "none"} />
                          </button>
                          {currentUser?.role === 'Super Admin' && (
                            <button
                              onClick={() => handleEditClick(o)}
                              className="premium-btn premium-btn-secondary"
                              style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(234, 179, 8, 0.4)', color: '#EAB308', backgroundColor: 'rgba(234, 179, 8, 0.08)' }}
                              title="Edit Order Details"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleCloneOrder(o)}
                            className="premium-btn premium-btn-secondary"
                            style={{ padding: '6px 8px', fontSize: '12px', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.08)' }}
                            title="Clone Order Information"
                          >
                            <Copy size={14} />
                          </button>
                          <InspectTooltipButton order={o} onClick={() => openOrderDetail(o)} />
                          <button
                            onClick={() => handleDeleteOrder(o)}
                            className="premium-btn premium-btn-danger"
                            style={{ padding: '6px 8px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#EF4444', color: '#EF4444' }}
                            title="Delete Order (Role Restricted)"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Custom Pagination Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#737373' }}>
                Showing {orders.length} of {totalCount} records (Page {page} of {totalPages})
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#737373' }}>Per page:</span>
                <select
                  className="premium-input"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '32px' }}
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10 entries</option>
                  <option value={30}>30 entries</option>
                  <option value={50}>50 entries</option>
                  <option value={100}>100 entries</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="premium-btn premium-btn-secondary"
                style={{ padding: '6px 10px' }}
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="premium-btn premium-btn-secondary"
                style={{ padding: '6px 10px' }}
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Manual Order */}
      {showAddModal && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', color: '#FAFAFA' }}>{isEditMode ? 'Edit Order Details' : 'Create New Manual Order'}</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleCreateOrder} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {formError && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF6868', borderRadius: '6px', padding: '10px 14px', fontSize: '13px' }}>
                  {formError}
                </div>
              )}

              {/* Sub-section: Customer Details */}
              <div>
                <h4 style={{ fontSize: '13px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid #1C1C21', paddingBottom: '6px' }}>
                  1. Customer Shipping Details
                </h4>

                <div className="premium-grid-2" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Full Name *</label>
                    <input type="text" className="premium-input" placeholder="Aditya Birla" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase' }}>Primary Phone *</label>
                      <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 600 }}>Prefilled (Admin Variable)</span>
                    </div>
                    <input type="tel" className="premium-input" placeholder="9876543210" value={phonePrimary} onChange={(e) => setPhonePrimary(e.target.value.replace(/\D/g, ''))} required />
                  </div>
                </div>

                <div className="premium-grid-2" style={{ marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase' }}>Secondary Phone</label>
                      <span style={{ fontSize: '10px', color: '#3B82F6', fontWeight: 600 }}>Prefilled (Admin Variable)</span>
                    </div>
                    <input type="tel" className="premium-input" placeholder="9876543211" value={phoneSecondary} onChange={(e) => setPhoneSecondary(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Customer Number</label>
                    <input type="tel" className="premium-input" placeholder="9876543212" value={phoneTertiary} onChange={(e) => setPhoneTertiary(e.target.value.replace(/\D/g, ''))} />
                  </div>
                </div>

                <div className="premium-grid-2" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>WhatsApp Number</label>
                    <input type="tel" className="premium-input" placeholder="9876543213" value={phoneWhatsApp} onChange={(e) => setPhoneWhatsApp(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div>
                    {/* Balanced empty grid item */}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase' }}>Complete Address *</label>
                    <AddressRatingIndicator address={address} showCharCount={true} style={{ fontSize: '10px', padding: '1px 4px' }} />
                  </div>
                  <input type="text" className="premium-input" placeholder="Flat 402, Sunset Heights, Bandra West" value={address} onChange={(e) => setAddress(e.target.value)} required />
                </div>

                <div className="premium-grid-3">
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Pincode (6 Digits) *</label>
                    <input type="text" maxLength={6} className="premium-input" placeholder="400050" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))} required />
                    {pincodeFetching && <span style={{ fontSize: '10px', color: '#737373' }}>Validating pin...</span>}
                    {pincodeSuccess && <span style={{ fontSize: '10px', color: 'var(--color-paid)' }}>🟢 Autofetch active</span>}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>State (Autofill)</label>
                    <input type="text" className="premium-input" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Area/District</label>
                    <input type="text" className="premium-input" placeholder="Area" value={area} onChange={(e) => setArea(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Sub-section: Order Details */}
              <div>
                <h4 style={{ fontSize: '13px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid #1C1C21', paddingBottom: '6px' }}>
                  2. Product & Value Details
                </h4>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Product Description *</label>
                  <input type="text" className="premium-input" placeholder="e.g. 99Store Premium Ceramic Coffee Mug - Matte Black" value={productDetails} onChange={(e) => setProductDetails(e.target.value)} required />
                </div>

                <div className="premium-grid-3" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Payment Type *</label>
                    <select 
                      className="premium-input" 
                      value={paymentType} 
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setPaymentType(val);
                        if (val === 'Paid') {
                          setPartiallyPaidAmount('');
                        }
                      }}
                    >
                      <option value="Paid">Prepaid (Paid)</option>
                      <option value="COD">Cash on Delivery (COD)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Value (INR) *</label>
                    <input type="number" className="premium-input" placeholder="999" value={orderValue} onChange={(e) => setOrderValue(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Weight (kg) *</label>
                    <input type="number" step="0.01" className="premium-input" placeholder="0.6" value={weight} onChange={(e) => setWeight(e.target.value)} required />
                  </div>
                </div>

                <div className="premium-grid-2" style={{ marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Partially Paid Amount (INR)</label>
                    <input 
                      type="number" 
                      className="premium-input" 
                      placeholder={paymentType === 'Paid' ? "N/A (Prepaid)" : "0"} 
                      value={partiallyPaidAmount} 
                      onChange={(e) => setPartiallyPaidAmount(e.target.value)} 
                      disabled={paymentType === 'Paid'}
                      style={paymentType === 'Paid' ? { backgroundColor: '#111113', cursor: 'not-allowed', color: '#52525B' } : {}}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Final Payable Amount (Autocalculated)</label>
                    <input
                      type="text"
                      className="premium-input"
                      style={{ backgroundColor: '#111113', color: '#10B981', fontWeight: 'bold' }}
                      value={`₹${(parseFloat(orderValue || '0') - parseFloat(partiallyPaidAmount || '0')).toFixed(2)}`}
                      disabled
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '4px', textTransform: 'uppercase' }}>Internal Fulfillment Remarks</label>
                  <textarea className="premium-input" placeholder="e.g. Handle with care, fragile item..." style={{ minHeight: '60px', resize: 'vertical' }} value={internalRemarks} onChange={(e) => setInternalRemarks(e.target.value)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="vip_tag" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--color-vip)' }} />
                  <label htmlFor="vip_tag" style={{ fontSize: '13px', color: '#FAFAFA', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <span>Mark as ⭐ VIP Order (VIP Badge indicator applied)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="premium-btn premium-btn-secondary">Cancel</button>
                <button type="submit" className="premium-btn premium-btn-primary" disabled={formLoading}>
                  {isEditMode ? (formLoading ? 'Saving...' : 'Save Changes') : (formLoading ? 'Creating order...' : 'Create Order')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Order Detail Summary & Timelines */}
      {showDetailModal && selectedOrder && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', color: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Order Details: {selectedOrder.orderId}</span>
                {selectedOrder.isVip && <Star size={14} fill="var(--color-vip)" style={{ color: 'var(--color-vip)' }} />}
              </h3>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Order Info Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', fontSize: '13.5px' }}>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Customer Name</span>
                  <span style={{ fontWeight: 600, color: '#FAFAFA' }}>{selectedOrder.customerName}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Phone Numbers</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>{selectedOrder.phonePrimary || 'N/A'} (Primary)</span>
                    <span>{selectedOrder.phoneSecondary || 'N/A'} (Secondary)</span>
                    <span>{selectedOrder.phoneTertiary || 'N/A'} (Customer)</span>
                    {selectedOrder.phoneWhatsApp && (
                      <span>{selectedOrder.phoneWhatsApp} (WhatsApp)</span>
                    )}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>State / Area</span>
                  <span>{selectedOrder.area}, {selectedOrder.state}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Pincode</span>
                  <span>{selectedOrder.pincode}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ color: '#737373', fontSize: '11px', textTransform: 'uppercase' }}>Shipping Address</span>
                    <AddressRatingIndicator address={selectedOrder.address} />
                  </div>
                  <span>{selectedOrder.address}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Product Description</span>
                  <span>{selectedOrder.productDetails}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Payment Type</span>
                  {selectedOrder.partiallyPaidAmount !== undefined && selectedOrder.partiallyPaidAmount > 0 && selectedOrder.orderValue > selectedOrder.partiallyPaidAmount ? (
                    <span className="premium-badge badge-partial" style={{ marginTop: '4px' }}>Partially Paid</span>
                  ) : (
                    <span className={`premium-badge ${selectedOrder.paymentType === 'Paid' ? 'badge-paid' : 'badge-cod'}`} style={{ marginTop: '4px' }}>
                      {selectedOrder.paymentType}
                    </span>
                  )}
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Total Order Value</span>
                  <span style={{ fontWeight: 'bold' }}>₹{selectedOrder.orderValue}</span>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Created By</span>
                  <span style={{ fontWeight: 600, color: '#FAFAFA' }}>{getUserDisplayName(selectedOrder.createdBy)}</span>
                </div>
                {selectedOrder.partiallyPaidAmount !== undefined && selectedOrder.partiallyPaidAmount > 0 && (
                  <>
                    <div>
                      <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Partially Paid Amount</span>
                      <span style={{ color: '#10B981', fontWeight: 600 }}>₹{selectedOrder.partiallyPaidAmount}</span>
                    </div>
                    <div>
                      <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Final Payable Balance</span>
                      <span style={{ color: '#10B981', fontWeight: 'bold' }}>₹{selectedOrder.finalPayableAmount || (selectedOrder.orderValue - selectedOrder.partiallyPaidAmount)}</span>
                    </div>
                  </>
                )}
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Fulfillment Courier</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    <CourierLogo courier={selectedOrder.courier} size={14} />
                  </div>
                </div>
                <div>
                  <span style={{ color: '#737373', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>AWB / Tracking</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'monospace' }}>{selectedOrder.awb || 'N/A'}</span>
                    {selectedOrder.awb && (
                      <button
                        onClick={() => handlePrintLabel(selectedOrder)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3B82F6',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0
                        }}
                      >
                        Print Label
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Order History Timeline */}
              <div>
                <h4 style={{ fontSize: '13px', color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px', borderBottom: '1px solid #1C1C21', paddingBottom: '6px' }}>
                  Fulfillment History Log
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px' }}>
                  {selectedOrder.history.map((hist, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                      {/* Timeline Connector Line */}
                      {idx < selectedOrder.history.length - 1 && (
                        <div style={{ position: 'absolute', left: '6px', top: '16px', bottom: '-16px', width: '1px', backgroundColor: 'var(--border)' }} />
                      )}

                      {/* Timeline Dot */}
                      <div style={{
                        width: '13px',
                        height: '13px',
                        borderRadius: '50%',
                        backgroundColor: '#1E1E24',
                        border: '2px solid var(--border-focus)',
                        marginTop: '3px',
                        zIndex: 1
                      }} />

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#FAFAFA' }}>{hist.status}</span>
                          <span style={{ fontSize: '11px', color: '#737373' }}>
                            {new Date(hist.timestamp).toLocaleString()} | by {hist.updatedBy}
                          </span>
                        </div>
                        <p style={{ fontSize: '12.5px', color: '#8A8A8A', marginTop: '4px', lineHeight: '1.4' }}>
                          {hist.remarks}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Duplicate Warning Popup */}
      {showDuplicateModal && (
        <div className="premium-modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="premium-modal" style={{ maxWidth: '580px', maxHeight: '85vh', overflowY: 'auto', border: '1px solid #EF4444' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#EF4444'
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', color: '#FAFAFA', fontWeight: 600 }}>Duplicate Order Detected</h3>
                <p style={{ fontSize: '12.5px', color: '#A1A1AA', marginTop: '2px' }}>Similar details were found in the database. Please review before proceeding.</p>
              </div>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: '#E4E4E7', lineHeight: '1.5' }}>
                Found <strong>{duplicateMatches.length} matching order(s)</strong> in the system that share details with your new order:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {duplicateMatches.map((match, idx) => (
                  <div key={match.id || idx} style={{
                    backgroundColor: '#18181B',
                    border: '1px solid #27272A',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#FAFAFA', fontSize: '13px', fontFamily: 'monospace' }}>
                        Order #{match.orderId}
                      </span>
                      <span className={`premium-badge status-${match.status.toLowerCase().replace(' ', '')}`} style={{ fontSize: '11px' }}>
                        {match.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '12.5px', color: '#D4D4D8' }}>
                      <strong>{match.customerName}</strong> ({match.phonePrimary})
                    </div>

                    <div style={{ fontSize: '12px', color: '#71717A' }}>
                      Address: {match.address}, {match.pincode}
                    </div>

                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {match.reasons.map((r: string, rIdx: number) => (
                        <div key={rIdx} style={{ fontSize: '11px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: '11px', color: '#71717A', textAlign: 'right', marginTop: '4px' }}>
                      Created on: {new Date(match.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              padding: '16px 24px',
              backgroundColor: '#111113',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="premium-btn premium-btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Go Back & Edit
              </button>

              <button
                type="button"
                onClick={executeOrderCreation}
                className="premium-btn premium-btn-primary"
                style={{
                  backgroundColor: '#EF4444',
                  borderColor: '#EF4444',
                  color: '#FFFFFF',
                  padding: '8px 16px',
                  fontSize: '13px'
                }}
              >
                Create Order Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Label CSS Printing Mock Modal */}
      {showPrintLabel && printingOrder && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '520px', backgroundColor: '#FFFFFF', color: '#000000', border: '2px solid #000000' }}>
            {/* Real Visual Shipping Invoice Label Card */}
            <div id="printable-shipping-label" className="thermal-shipping-label" style={{ padding: '0', backgroundColor: '#FFFFFF', width: '4in', margin: '0 auto' }}>
              <HealvitaShippingLabel order={printingOrder} />
            </div>

            {/* Print operations bar */}
            <div style={{ padding: '16px', backgroundColor: '#F4F4F5', borderTop: '2px solid #000000', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPrintLabel(false)}
                className="premium-btn premium-btn-secondary"
                style={{ color: '#000', borderColor: '#000', padding: '6px 12px' }}
              >
                Close Print Queue
              </button>

              <button
                onClick={handlePrint}
                className="premium-btn premium-btn-primary"
                style={{ backgroundColor: '#000', color: '#FFF', border: 'none', padding: '6px 12px' }}
              >
                <Printer size={14} />
                <span>Print Label</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: WhatsApp Notification Success/Error Status */}
      {whatsAppSuccessModal.show && (
        <div className="premium-modal-backdrop" style={{ zIndex: 1300 }}>
          <div className="premium-modal animate-fade-in" style={{ maxWidth: '400px', borderColor: whatsAppSuccessModal.isError ? '#EF4444' : '#10B981' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: whatsAppSuccessModal.isError ? '#EF4444' : '#10B981' }} />
                <h3 style={{ fontSize: '15px', color: '#FAFAFA', fontWeight: 600, letterSpacing: '0.3px', margin: 0 }}>
                  {whatsAppSuccessModal.title}
                </h3>
              </div>
              <button 
                onClick={() => setWhatsAppSuccessModal(prev => ({ ...prev, show: false }))} 
                style={{ background: 'none', border: 'none', color: '#737373', cursor: 'pointer', fontSize: '13px' }}
              >
                Close
              </button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: '#E4E4E7', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
                {whatsAppSuccessModal.message}
              </p>
              
              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setWhatsAppSuccessModal(prev => ({ ...prev, show: false }))} 
                  className="premium-btn premium-btn-primary"
                  style={{ 
                    backgroundColor: whatsAppSuccessModal.isError ? '#EF4444' : '#10B981', 
                    borderColor: whatsAppSuccessModal.isError ? '#EF4444' : '#10B981', 
                    color: '#FFFFFF' 
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WhatsApp Template Selection & Cooldown */}
      {whatsAppSelectModal.show && whatsAppSelectModal.order && (
        <div className="premium-modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="premium-modal animate-fade-in" style={{ maxWidth: '520px', width: '95%' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', color: '#FAFAFA', fontWeight: 600, margin: 0 }}>
                On-Demand WhatsApp Messaging
              </h3>
              {!whatsAppSelectModal.loading && (
                <button 
                  onClick={() => setWhatsAppSelectModal({ show: false, order: null, selectedNumbers: [], loading: false, logsLoading: false })}
                  style={{ background: 'none', border: 'none', color: '#737373', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
              )}
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{ color: '#A3A3A3', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>
                Select recipient numbers for order <strong>{whatsAppSelectModal.order.orderId}</strong>:
              </p>

              {/* Recipient select checkboxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Primary Contact (Customer)', value: whatsAppSelectModal.order.phonePrimary },
                  { label: 'Secondary Contact (Alternate)', value: whatsAppSelectModal.order.phoneSecondary },
                  { label: 'Tertiary Contact (Alternate)', value: whatsAppSelectModal.order.phoneTertiary },
                  { label: 'WhatsApp Number', value: whatsAppSelectModal.order.phoneWhatsApp },
                ].filter(item => item.value && item.value.trim() !== '').map((item, idx) => {
                  const cleanNum = item.value!.trim();
                  const isChecked = whatsAppSelectModal.selectedNumbers.includes(cleanNum);
                  return (
                    <label 
                      key={idx}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '10px', 
                        padding: '10px 12px', 
                        backgroundColor: 'rgba(255, 255, 255, 0.01)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setWhatsAppSelectModal(prev => {
                            const newNumbers = prev.selectedNumbers.includes(cleanNum)
                              ? prev.selectedNumbers.filter(n => n !== cleanNum)
                              : [...prev.selectedNumbers, cleanNum];
                            return { ...prev, selectedNumbers: newNumbers };
                          });
                        }}
                        style={{ width: '15px', height: '15px', accentColor: '#10B981', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '12px', color: '#FAFAFA', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanNum}</span>
                        <span style={{ fontSize: '9.5px', color: '#737373', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <p style={{ color: '#A3A3A3', fontSize: '13px', margin: '10px 0 0 0', lineHeight: '1.5' }}>
                Available Templates:
              </p>

              {/* Templates List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {WHATSAPP_TEMPLATES.map((tmpl) => {
                  const isSent = (whatsAppSelectModal.logs || []).some(
                    log => log.templateName === tmpl.key && log.status === 'Sent'
                  );
                  const isSendingThis = whatsAppSelectModal.loading && whatsAppSelectModal.sendingTemplate === tmpl.key;

                  return (
                    <div 
                      key={tmpl.key} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12.5px', color: '#FAFAFA', fontWeight: 600 }}>{tmpl.name}</span>
                          <span style={{ fontSize: '9px', color: '#737373', backgroundColor: 'rgba(255,255,255,0.03)', padding: '1px 4px', borderRadius: '3px' }}>{tmpl.key}</span>
                        </div>
                        <p style={{ fontSize: '11px', color: '#8A8A8A', margin: '2px 0 0 0', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {tmpl.desc}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {whatsAppSelectModal.logsLoading ? (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            color: '#A1A1AA',
                            padding: '2px 6px',
                            animation: 'pulse 1.5s infinite'
                          }}>
                            Checking...
                          </span>
                        ) : isSent ? (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: '#10B981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            SENT
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 500,
                            color: '#737373',
                            padding: '2px 6px',
                          }}>
                            NOT SENT
                          </span>
                        )}

                        <button
                          onClick={() => handleTriggerWhatsAppSend(tmpl.key)}
                          disabled={whatsAppSelectModal.logsLoading || cooldownSeconds > 0 || whatsAppSelectModal.selectedNumbers.length === 0 || whatsAppSelectModal.loading}
                          className="premium-btn premium-btn-primary"
                          style={{
                            padding: '6px 12px',
                            fontSize: '11.5px',
                            minWidth: '85px',
                            justifyContent: 'center',
                            backgroundColor: (whatsAppSelectModal.logsLoading || cooldownSeconds > 0) ? 'rgba(255,255,255,0.03)' : undefined,
                            borderColor: (whatsAppSelectModal.logsLoading || cooldownSeconds > 0) ? 'var(--border)' : undefined,
                            color: (whatsAppSelectModal.logsLoading || cooldownSeconds > 0) ? '#737373' : undefined
                          }}
                          title={whatsAppSelectModal.logsLoading ? 'Loading status...' : cooldownSeconds > 0 ? `Please wait ${cooldownSeconds}s before sending another message.` : undefined}
                        >
                          {isSendingThis ? (
                            <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1.5px' }} />
                          ) : whatsAppSelectModal.logsLoading ? (
                            'Loading...'
                          ) : cooldownSeconds > 0 ? (
                            `Wait ${cooldownSeconds}s`
                          ) : (
                            'Send'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setWhatsAppSelectModal({ show: false, order: null, selectedNumbers: [], loading: false, logsLoading: false })}
                  className="premium-btn premium-btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Close Modal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
