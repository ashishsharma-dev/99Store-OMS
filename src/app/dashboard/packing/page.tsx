'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Printer, 
  Send, 
  Tag, 
  Check, 
  RefreshCcw, 
  ArrowRight,
  Barcode,
  Calendar,
  Download,
  Info,
  Search,
  Filter,
  ChevronDown
} from 'lucide-react';
import { Order, OrderStatus } from '@/lib/types';
import { HealvitaShippingLabel } from '@/components/HealvitaShippingLabel';
import { printThermalLabel } from '@/lib/printLabel';
import { CourierLogo } from '@/components/CourierLogo';
import { DateRangeFilter, DateRange } from '@/components/DateRangeFilter';
import { checkCourierServiceability } from '@/lib/utils';

export default function Packing() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'all',
    startDate: '',
    endDate: ''
  });
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Printing label popup state (can print single or multiple)
  const [printingOrders, setPrintingOrders] = useState<Order[]>([]);
  const [showPrintLabel, setShowPrintLabel] = useState(false);

  // Selected courier overrides for each order during packing
  const [courierOverrides, setCourierOverrides] = useState<Record<string, 'DTDC' | 'XpressBees' | 'Delhivery' | 'Aggregator' | 'Velocity'>>({});
  
  // Primary phone selection override if customer has multiple phone numbers
  const [phoneSelections, setPhoneSelections] = useState<Record<string, string>>({});
  
  // Selection states for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({
    total: 0,
    current: 0,
    success: 0,
    failed: 0,
    activeOrder: '',
    completedList: [] as { orderId: string; success: boolean; message: string }[]
  });

  // Module 4: Bulk Logistics header dropdown filters
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [contactBindingFilter, setContactBindingFilter] = useState<string>('Primary');

  // Reassign Modal States
  const [reassignOrder, setReassignOrder] = useState<Order | null>(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignCourier, setReassignCourier] = useState('DTDC');
  const [reassignRemark, setReassignRemark] = useState('');
  const [reassignLoading, setReassignLoading] = useState(false);
  const [showAwbErrorModal, setShowAwbErrorModal] = useState(false);
  const [awbErrorDetails, setAwbErrorDetails] = useState<{ orderId: string; courier: string; pincode: string; error: string } | null>(null);
  const [serviceabilityCache, setServiceabilityCache] = useState<Record<string, boolean>>({});
  const fetchingKeys = useRef<Set<string>>(new Set());
  const [modalServiceability, setModalServiceability] = useState<Record<string, 'loading' | 'serviceable' | 'unserviceable'>>({});
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkReassignCourier, setBulkReassignCourier] = useState('Delhivery');
  const [bulkReassignLoading, setBulkReassignLoading] = useState(false);
  const [inlineReassignLoading, setInlineReassignLoading] = useState<string | null>(null);

  // Infinite Scroll Batch Limit State
  const [displayLimit, setDisplayLimit] = useState<number>(20);

  // Single AWB Dispatch Modal State
  const [singleDispatchOrder, setSingleDispatchOrder] = useState<Order | null>(null);
  const [singleDispatchCourier, setSingleDispatchCourier] = useState<string>('DTDC');
  const [singleDispatchPhoneChoice, setSingleDispatchPhoneChoice] = useState<string>('Primary');
  const [singleDispatchCustomPhone, setSingleDispatchCustomPhone] = useState<string>('');

  // Bulk AWB Dispatch Modal State
  const [showBulkDispatchModal, setShowBulkDispatchModal] = useState<boolean>(false);
  const [bulkDispatchCourier, setBulkDispatchCourier] = useState<string>('DTDC');
  const [bulkDispatchPhoneBinding, setBulkDispatchPhoneBinding] = useState<string>('Primary');

  // Infinite Scroll Reset
  useEffect(() => {
    setDisplayLimit(20);
  }, [search, statusFilter, courierFilter, dateRange]);

  useEffect(() => {
    if (showAwbErrorModal && awbErrorDetails) {
      const checkAllCouriers = async () => {
        const couriers = ['Delhivery', 'XpressBees', 'DTDC'];
        const pincode = awbErrorDetails.pincode;
        
        const initialStates: Record<string, 'loading' | 'serviceable' | 'unserviceable'> = {};
        couriers.forEach(c => {
          initialStates[c] = 'loading';
        });
        setModalServiceability(initialStates);

        try {
          const res = await fetch('/api/integrations/pincode/serviceability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              checks: couriers.map(c => ({ pincode, courier: c }))
            })
          });

          if (res.ok) {
            const data = await res.json();
            const results = data.results || {};
            const updatedStates: Record<string, 'loading' | 'serviceable' | 'unserviceable'> = {};
            couriers.forEach(c => {
              const key = `${pincode}-${c}`;
              const isServiceable = results[key] === true;
              updatedStates[c] = isServiceable ? 'serviceable' : 'unserviceable';
            });
            setModalServiceability(updatedStates);
          } else {
            const fallbackStates: Record<string, 'loading' | 'serviceable' | 'unserviceable'> = {};
            couriers.forEach(c => {
              fallbackStates[c] = 'unserviceable';
            });
            setModalServiceability(fallbackStates);
          }
        } catch (e) {
          const fallbackStates: Record<string, 'loading' | 'serviceable' | 'unserviceable'> = {};
          couriers.forEach(c => {
            fallbackStates[c] = 'unserviceable';
          });
          setModalServiceability(fallbackStates);
        }
      };
      checkAllCouriers();
    } else {
      setModalServiceability({});
    }
  }, [showAwbErrorModal, awbErrorDetails]);

  useEffect(() => {
    const session = localStorage.getItem('99store_user');
    if (session) {
      setCurrentUser(JSON.parse(session));
    }
  }, []);

  useEffect(() => {
    fetchPackingQueue();
  }, [dateRange]);

  const fetchPackingQueue = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      let url = '/api/orders?limit=100000';
      if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
      if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.orders) {
        const todayStr = new Date().toISOString().split('T')[0];
        const queue = (data.orders as Order[]).filter(o => {
          const isCorrectStatus = o.status === 'Created' || o.status === 'Packing' || o.status === 'Label Generated' || o.status === 'Dispatched';
          if (!isCorrectStatus) return false;
          if (o.futureDeliveryDate && o.futureDeliveryDate > todayStr) return false;
          return true;
        });
        setOrders(queue);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleCourierSelectChange = (orderId: string, courier: any) => {
    setCourierOverrides(prev => ({ ...prev, [orderId]: courier }));
  };

  const handlePhoneSelectChange = (orderId: string, phoneNumber: string) => {
    setPhoneSelections(prev => ({ ...prev, [orderId]: phoneNumber }));
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const filteredOrders = orders.filter(o => {
    // 1. Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'Ready to Dispatch' || statusFilter === 'Label Generated') {
        if (o.status !== 'Label Generated') return false;
      } else if (o.status !== statusFilter) {
        return false;
      }
    }
    // 2. Courier Filter
    if (courierFilter !== 'all') {
      const c = courierOverrides[o.id] || o.courier || 'DTDC';
      if (!c.toLowerCase().includes(courierFilter.toLowerCase())) return false;
    }
    // 3. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        o.orderId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phonePrimary.includes(q) ||
        (o.phoneSecondary && o.phoneSecondary.includes(q)) ||
        (o.phoneTertiary && o.phoneTertiary.includes(q)) ||
        (o.awb && o.awb.toLowerCase().includes(q)) ||
        (o.pincode && o.pincode.includes(q)) ||
        o.address.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Perform background live serviceability checks for visible orders
  useEffect(() => {
    let isMounted = true;

    const checkAllServiceability = async () => {
      const uniqueChecksMap: Record<string, { pincode: string; courier: string }> = {};

      filteredOrders.forEach(o => {
        const activeCourier = courierOverrides[o.id] || o.courier || 'DTDC';
        const cacheKey = `${o.pincode}-${activeCourier}`;

        if (serviceabilityCache[cacheKey] === undefined && !fetchingKeys.current.has(cacheKey)) {
          uniqueChecksMap[cacheKey] = { pincode: o.pincode, courier: activeCourier };
        }
      });

      const pendingChecks = Object.values(uniqueChecksMap);
      if (pendingChecks.length === 0) return;

      const keysToFetch = Object.keys(uniqueChecksMap);
      keysToFetch.forEach(key => fetchingKeys.current.add(key));

      try {
        const res = await fetch('/api/integrations/pincode/serviceability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checks: pendingChecks })
        });

        if (!res.ok) throw new Error('Batch serviceability check failed.');

        const data = await res.json();

        if (isMounted && data.results) {
          setServiceabilityCache(prev => ({
            ...prev,
            ...data.results
          }));
        }
      } catch (err) {
        console.error('Batch serviceability check failed, falling back to static rules:', err);
        if (isMounted) {
          const fallbackResults: Record<string, boolean> = {};
          pendingChecks.forEach(({ pincode, courier }) => {
            const cacheKey = `${pincode}-${courier}`;
            fallbackResults[cacheKey] = checkCourierServiceability(pincode, courier);
          });
          setServiceabilityCache(prev => ({
            ...prev,
            ...fallbackResults
          }));
        }
      } finally {
        keysToFetch.forEach(key => fetchingKeys.current.delete(key));
      }
    };

    checkAllServiceability();

    return () => {
      isMounted = false;
    };
  }, [filteredOrders, courierOverrides]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 350) {
        setDisplayLimit(prev => Math.min(prev + 20, filteredOrders.length));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredOrders.length]);

  const handleSelectAll = () => {
    if (selectedIds.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map(o => o.id));
    }
  };

  // Open single dispatch modal
  const handleOpenSingleDispatchModal = (order: Order) => {
    setSingleDispatchOrder(order);
    setSingleDispatchCourier(courierOverrides[order.id] || order.courier || 'DTDC');
    setSingleDispatchPhoneChoice('Primary');
    setSingleDispatchCustomPhone('');
  };

  // Confirm & Generate Single AWB
  const confirmSingleDispatch = async () => {
    if (!singleDispatchOrder) return;

    let targetPhone = singleDispatchOrder.phonePrimary;
    if (singleDispatchPhoneChoice === 'Secondary' && singleDispatchOrder.phoneSecondary) {
      targetPhone = singleDispatchOrder.phoneSecondary;
    } else if (singleDispatchPhoneChoice === 'Tertiary' && singleDispatchOrder.phoneTertiary) {
      targetPhone = singleDispatchOrder.phoneTertiary;
    } else if (singleDispatchPhoneChoice === 'Custom' && singleDispatchCustomPhone.trim()) {
      targetPhone = singleDispatchCustomPhone.trim();
    }

    const orderToProcess = singleDispatchOrder;
    const courierChoice = singleDispatchCourier;
    setSingleDispatchOrder(null);
    handleGenerateLabel(orderToProcess, courierChoice, targetPhone);
  };

  // Generate AWB for single order
  const handleGenerateLabel = async (order: Order, courierChoice?: string, phoneChoice?: string) => {
    setProcessingOrderId(order.id);
    const selectedCourier = courierChoice || courierOverrides[order.id] || order.courier || 'DTDC';
    const targetPhone = phoneChoice || phoneSelections[order.id] || order.phonePrimary;

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Label Generated',
          courier: selectedCourier,
          phonePrimary: targetPhone,
          updatedBy: currentUser?.username || 'packing_operator',
          remarks: `Packed items verified. Routing via ${selectedCourier} courier with shipping number ${targetPhone}.`
        })
      });

      const data = await res.json();
      setProcessingOrderId(null);

      if (res.ok) {
        if (data.awbError) {
          setAwbErrorDetails({
            orderId: order.orderId,
            courier: selectedCourier,
            pincode: order.pincode,
            error: data.awbError
          });
          setShowAwbErrorModal(true);
        }
        fetchPackingQueue();
      } else {
        alert(data.error || 'Failed to generate AWB label.');
      }
    } catch (err) {
      setProcessingOrderId(null);
      alert('API Communication network error.');
    }
  };

  // Dispatch single order
  const handleDispatch = async (order: Order) => {
    if (!order.awb) {
      alert('AWB is required to dispatch package.');
      return;
    }
    
    setProcessingOrderId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Dispatched',
          updatedBy: currentUser?.username || 'packing_operator',
          remarks: `Package labeled with AWB ${order.awb}. Handed over to logistics pickup driver.`
        })
      });

      setProcessingOrderId(null);
      if (res.ok) {
        fetchPackingQueue();
      }
    } catch (err) {
      setProcessingOrderId(null);
      alert('Dispatch API network error.');
    }
  };

  // Open bulk dispatch modal
  const handleOpenBulkDispatchModal = () => {
    if (selectedIds.length === 0) return;
    const pendingAWB = orders.filter(o => selectedIds.includes(o.id) && !o.awb);
    if (pendingAWB.length === 0) {
      alert('No selected orders require AWB generation.');
      return;
    }
    setShowBulkDispatchModal(true);
  };

  // BULK ACTIONS
  const executeBulkGenerateLabels = async (chosenCourier: string, chosenPhoneBinding: string) => {
    if (selectedIds.length === 0) return;

    const pendingAWB = orders.filter(o => selectedIds.includes(o.id) && !o.awb);
    if (pendingAWB.length === 0) {
      alert('No selected orders require AWB generation.');
      return;
    }

    setBulkProgress({
      total: pendingAWB.length,
      current: 0,
      success: 0,
      failed: 0,
      activeOrder: '',
      completedList: []
    });
    setBulkProcessing(true);

    try {
      const startRes = await fetch('/api/bulk-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: pendingAWB.map(o => o.id),
          courier: chosenCourier,
          phoneBinding: chosenPhoneBinding,
          username: currentUser?.username || 'packing_operator'
        })
      });

      const startData = await startRes.json();
      if (!startRes.ok || !startData.success || !startData.job) {
        alert(startData.error || 'Failed to initialize background bulk AWB job.');
        setBulkProcessing(false);
        return;
      }

      const jobId = startData.job.id;

      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/bulk-jobs?jobId=${jobId}`);
          const pollData = await pollRes.json();

          if (pollRes.ok && pollData.success && pollData.job) {
            const job = pollData.job;
            setBulkProgress({
              total: job.total,
              current: job.current,
              success: job.successCount,
              failed: job.failedCount,
              activeOrder: job.activeOrder,
              completedList: job.results.map((r: any) => ({
                orderId: r.orderId,
                success: r.success,
                message: r.message
              }))
            });

            if (job.status === 'Completed' || job.status === 'Failed') {
              clearInterval(pollInterval);
              setBulkProcessing(false);
              fetchPackingQueue();
            }
          } else {
            clearInterval(pollInterval);
            alert('Error occurred while polling bulk job progress.');
            setBulkProcessing(false);
            fetchPackingQueue();
          }
        } catch (pollErr) {
          console.error('Error polling bulk job:', pollErr);
        }
      }, 1500);

    } catch (err: any) {
      alert(err.message || 'Fatal error initiating bulk generation.');
      setBulkProcessing(false);
    }
  };

  const handleBulkPrintLabels = () => {
    const selectedOrders = orders.filter(o => selectedIds.includes(o.id) && o.awb);
    if (selectedOrders.length === 0) {
      alert('Please select orders that have generated AWB numbers to print shipping labels.');
      return;
    }
    setPrintingOrders(selectedOrders);
    setShowPrintLabel(true);
  };

  const handleBulkDispatch = async () => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);

    const dispatchable = orders.filter(o => selectedIds.includes(o.id) && o.status === 'Label Generated' && o.awb);
    if (dispatchable.length === 0) {
      alert('No selected orders are ready for dispatch (must be "Label Generated" with AWB).');
      setBulkProcessing(false);
      return;
    }

    let successCount = 0;
    for (const order of dispatchable) {
      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Dispatched',
            updatedBy: currentUser?.username || 'packing_operator',
            remarks: `Bulk Dispatch: Package marked as Dispatched with AWB ${order.awb}.`
          })
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error(err);
      }
    }

    alert(`Bulk Dispatch complete. Successfully dispatched ${successCount} of ${dispatchable.length} packages.`);
    setBulkProcessing(false);
    fetchPackingQueue();
  };

  const handlePrint = () => {
    printThermalLabel('printable-labels-boundary');
  };

  const handleExportCsv = () => {
    let url = `/api/reports?queue=packing&courier=${courierFilter}`;
    if (dateRange.startDate) url += `&startDate=${encodeURIComponent(dateRange.startDate)}`;
    if (dateRange.endDate) url += `&endDate=${encodeURIComponent(dateRange.endDate)}`;
    window.open(url);
  };

  const handleOpenReassign = (order: Order) => {
    const activeCourier = courierOverrides[order.id] || order.courier || 'DTDC';
    setReassignOrder(order);
    setReassignCourier(activeCourier);
    setReassignRemark(`Pincode ${order.pincode} is not serviceable with ${activeCourier}. Reassigned order.`);
    setShowReassignModal(true);
  };

  const handleConfirmReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignOrder || !reassignCourier || !reassignRemark) return;

    setReassignLoading(true);
    try {
      const res = await fetch(`/api/orders/${reassignOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Created',
          courier: reassignCourier,
          awb: '',
          eta: '',
          futureDeliveryDate: '',
          remarks: reassignRemark,
          updatedBy: currentUser?.username || 'packing_operator'
        })
      });

      if (res.ok) {
        setShowReassignModal(false);
        setReassignOrder(null);
        fetchPackingQueue();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reassign order.');
      }
    } catch (err) {
      alert('Network error when reassigning.');
    } finally {
      setReassignLoading(false);
    }
  };

  const handleInlineReassign = async (orderId: string, courierName: string, pincode: string) => {
    setInlineReassignLoading(courierName);
    try {
      // Find the corresponding order ID
      const order = orders.find(o => o.orderId === orderId);
      if (!order) return;

      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Created',
          courier: courierName,
          awb: '',
          eta: '',
          futureDeliveryDate: '',
          remarks: `Pincode ${pincode} unserviceable. Inline reassigned to ${courierName} from exception modal.`,
          updatedBy: currentUser?.username || 'packing_operator'
        })
      });

      if (res.ok) {
        setShowAwbErrorModal(false);
        setAwbErrorDetails(null);
        fetchPackingQueue();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reassign order.');
      }
    } catch (err) {
      alert('Network error when reassigning.');
    } finally {
      setInlineReassignLoading(null);
    }
  };

  const handleBulkReassign = async () => {
    if (selectedIds.length === 0) return;
    setBulkReassignLoading(true);

    try {
      const pendingReassign = orders.filter(o => selectedIds.includes(o.id));
      
      const reassignPromises = pendingReassign.map(async (order) => {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'Created',
            courier: bulkReassignCourier,
            awb: '',
            eta: '',
            futureDeliveryDate: '',
            remarks: `Bulk courier reassign. Courier changed to ${bulkReassignCourier}.`,
            updatedBy: currentUser?.username || 'packing_operator'
          })
        });
        return res.ok;
      });

      const results = await Promise.all(reassignPromises);
      const successCount = results.filter(Boolean).length;
      
      alert(`Successfully reassigned ${successCount} of ${pendingReassign.length} orders to ${bulkReassignCourier}.`);
      setShowBulkReassignModal(false);
      fetchPackingQueue();
    } catch (err) {
      alert('Network error when bulk reassigning.');
    } finally {
      setBulkReassignLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', color: '#FAFAFA' }}>Packaging & Label Queue</h1>
          <p style={{ color: '#737373', fontSize: '13.5px', marginTop: '4px' }}>
            Verify products, assign logistics providers, select contact numbers, print monochrome thermal invoices, and dispatch packages.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <button onClick={handleExportCsv} className="premium-btn premium-btn-secondary" style={{ padding: '8px 12px' }}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button onClick={fetchPackingQueue} className="premium-btn premium-btn-secondary" disabled={loading || bulkProcessing} style={{ padding: '8px 12px' }}>
            <RefreshCcw size={14} />
            <span>Reload Queue</span>
          </button>
        </div>
      </div>

      {/* Queue Counter Dashboard banner */}
      <div className="premium-card" style={{ padding: '14px 20px', display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: '#0F0F11', borderStyle: 'dashed', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={18} style={{ color: '#3B82F6' }} />
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#FAFAFA' }}>
            Packing Load:
          </span>
        </div>
        <div style={{ fontSize: '13px', color: '#8A8A8A', flex: 1, display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            onClick={() => setStatusFilter('all')}
            style={{ background: statusFilter === 'all' ? 'rgba(59,130,246,0.2)' : 'none', border: '1px solid ' + (statusFilter === 'all' ? '#3B82F6' : '#27272A'), color: statusFilter === 'all' ? '#60A5FA' : '#A1A1AA', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >
            <strong>{orders.length}</strong> All Orders
          </button>

          <button 
            onClick={() => setStatusFilter('Created')}
            style={{ background: statusFilter === 'Created' ? 'rgba(59,130,246,0.2)' : 'none', border: '1px solid ' + (statusFilter === 'Created' ? '#3B82F6' : '#27272A'), color: statusFilter === 'Created' ? '#60A5FA' : '#A1A1AA', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >
            <strong>{orders.filter(o => o.status === 'Created').length}</strong> New Orders
          </button>

          <button 
            onClick={() => setStatusFilter('Packing')}
            style={{ background: statusFilter === 'Packing' ? 'rgba(245,158,11,0.2)' : 'none', border: '1px solid ' + (statusFilter === 'Packing' ? '#F59E0B' : '#27272A'), color: statusFilter === 'Packing' ? '#FBBF24' : '#A1A1AA', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >
            <strong>{orders.filter(o => o.status === 'Packing').length}</strong> Currently Packing
          </button>

          <button 
            onClick={() => setStatusFilter('Ready to Dispatch')}
            style={{ background: (statusFilter === 'Ready to Dispatch' || statusFilter === 'Label Generated') ? 'rgba(16,185,129,0.2)' : 'none', border: '1px solid ' + ((statusFilter === 'Ready to Dispatch' || statusFilter === 'Label Generated') ? '#10B981' : '#27272A'), color: (statusFilter === 'Ready to Dispatch' || statusFilter === 'Label Generated') ? '#34D399' : '#A1A1AA', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >
            <strong>{orders.filter(o => o.status === 'Label Generated').length}</strong> Ready to Dispatch
          </button>

          <button 
            onClick={() => setStatusFilter('Dispatched')}
            style={{ background: statusFilter === 'Dispatched' ? 'rgba(139,92,246,0.2)' : 'none', border: '1px solid ' + (statusFilter === 'Dispatched' ? '#8B5CF6' : '#27272A'), color: statusFilter === 'Dispatched' ? '#A78BFA' : '#A1A1AA', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
          >
            <strong>{orders.filter(o => o.status === 'Dispatched').length}</strong> Dispatched
          </button>
        </div>
      </div>

      {/* Global Search & Filters Toolboard */}
      <div 
        className="premium-card" 
        style={{ 
          padding: '10px 14px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          flexWrap: 'wrap',
          backgroundColor: '#09090B',
          borderColor: '#27272A'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '220px', maxWidth: '300px', flex: 1 }}>
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
            placeholder="Search Order ID, Name, Phone, AWB, Pincode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Filter size={14} style={{ color: '#737373', flexShrink: 0 }} />

        {/* Status filter */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{ 
              width: 'auto', 
              minWidth: '150px', 
              padding: '6px 28px 6px 12px',
              height: '34px',
              fontSize: '12.5px',
              backgroundColor: '#18181B',
              borderColor: '#3B82F6',
              appearance: 'none',
              cursor: 'pointer'
            }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Status (All Orders)</option>
            <option value="Created">Created (New Orders)</option>
            <option value="Packing">Currently Packing</option>
            <option value="Ready to Dispatch">Ready to Dispatch</option>
            <option value="Dispatched">Dispatched</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        {/* Courier Partner filter */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{ 
              width: 'auto', 
              minWidth: '160px', 
              padding: '6px 28px 6px 12px',
              height: '34px',
              fontSize: '12.5px',
              backgroundColor: '#18181B',
              borderColor: '#10B981',
              appearance: 'none',
              cursor: 'pointer'
            }}
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
          >
            <option value="all">All Carrier Partners</option>
            <option value="DTDC">DTDC Express</option>
            <option value="XpressBees">XpressBees Logistics</option>
            <option value="Delhivery">Delhivery Express</option>
            <option value="Aggregator">Aggregator API</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>

        {/* Pickup Contact Binding */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            className="premium-input"
            style={{ 
              width: 'auto', 
              minWidth: '170px', 
              padding: '6px 28px 6px 12px',
              height: '34px',
              fontSize: '12.5px',
              backgroundColor: '#18181B',
              borderColor: '#F59E0B',
              appearance: 'none',
              cursor: 'pointer'
            }}
            value={contactBindingFilter}
            onChange={(e) => setContactBindingFilter(e.target.value)}
          >
            <option value="Primary">Primary Store Contact</option>
            <option value="Secondary">Secondary Fulfillment Hub</option>
            <option value="Tertiary">CUSTOMER_NUMBER (Masked)</option>
          </select>
          <ChevronDown size={12} style={{ position: 'absolute', right: '8px', pointerEvents: 'none', color: '#71717A' }} />
        </div>
      </div>

      {/* Bulk Operations Toolbar */}
      {selectedIds.length > 0 && (
        <div className="premium-card animate-fade-in" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111113', borderColor: '#3B82F6' }}>
          <span style={{ fontSize: '13.5px', color: '#FAFAFA', fontWeight: 600 }}>
            Selected {selectedIds.length} of {filteredOrders.length} orders
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setShowBulkReassignModal(true)} 
              className="premium-btn premium-btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12.5px', borderColor: '#EF4444', color: '#EF4444' }}
              disabled={bulkProcessing}
            >
              Bulk Reassign Courier
            </button>
            <button 
              onClick={handleOpenBulkDispatchModal} 
              className="premium-btn premium-btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12.5px', borderColor: '#3B82F6', color: '#3B82F6' }}
              disabled={bulkProcessing}
            >
              Bulk Generate AWB
            </button>
            <button 
              onClick={handleBulkPrintLabels} 
              className="premium-btn premium-btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12.5px', borderColor: '#F59E0B', color: '#F59E0B' }}
              disabled={bulkProcessing}
            >
              Bulk Print Labels (4x6)
            </button>
            <button 
              onClick={handleBulkDispatch} 
              className="premium-btn premium-btn-primary" 
              style={{ padding: '6px 12px', fontSize: '12.5px', backgroundColor: '#10B981', borderColor: '#10B981' }}
              disabled={bulkProcessing}
            >
              Bulk Dispatch Packages
            </button>
          </div>
        </div>
      )}

      {/* Main Packing Table */}
      {loading ? (
        <div className="premium-card loading-overlay" style={{ minHeight: '200px' }}>
          <span className="spinner spinner-lg spinner-accent" />
          <span>Retrieving packaging queue...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="premium-card" style={{ textAlign: 'center', padding: '48px', color: '#737373' }}>
          No packages pending in the packaging queue for this selection. Good job! All orders are dispatched.
        </div>
      ) : (
        <div className="premium-table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th style={{ width: '40px', paddingLeft: '16px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0} 
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </th>
                <th>Order ID</th>
                <th>Customer details</th>
                <th>Product Weight</th>
                <th>Courier & Primary Phone</th>
                <th>Fulfillment State</th>
                <th style={{ textAlign: 'right' }}>Operations Control</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.slice(0, displayLimit).map((o) => {
                const isProcessing = processingOrderId === o.id || bulkProcessing;
                const activeCourier = courierOverrides[o.id] || o.courier || 'DTDC';
                const hasMultiplePhones = o.phoneSecondary || o.phoneTertiary;
                const activePhone = phoneSelections[o.id] || o.phonePrimary;

                // Color highlights for partially paid amount
                const isPartiallyPaid = o.partiallyPaidAmount !== undefined && o.partiallyPaidAmount > 0;
                
                // Courier serviceability check
                const cacheKey = `${o.pincode}-${activeCourier}`;
                const isServiceable = serviceabilityCache[cacheKey] !== undefined 
                  ? serviceabilityCache[cacheKey] 
                  : checkCourierServiceability(o.pincode, activeCourier);
                
                return (
                  <tr 
                    key={o.id}
                    style={{
                      borderLeft: isPartiallyPaid ? '3px solid #10B981' : 'none',
                      backgroundColor: isPartiallyPaid ? 'rgba(16,185,129,0.08)' : 'transparent'
                    }}
                  >
                    <td style={{ paddingLeft: '16px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(o.id)} 
                        onChange={() => handleSelectOrder(o.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span 
                          title={o.internalRemarks ? `Internal Fulfillment Remarks: ${o.internalRemarks}` : 'No internal remarks'} 
                          style={{ 
                            cursor: 'help', 
                            color: o.internalRemarks ? '#3B82F6' : '#737373', 
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <Info size={13} />
                        </span>
                        <span>{o.orderId}</span>
                        {o.isVip && <span style={{ color: 'var(--color-vip)' }}>⭐</span>}
                      </div>
                      <span style={{ fontSize: '11px', color: '#737373', fontWeight: 'normal' }}>{o.createdAt.split('T')[0]}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.customerName}</div>
                      <div style={{ fontSize: '11.5px', color: '#737373' }}>{o.pincode} | {o.area}, {o.state}</div>
                    </td>
                    <td>
                      <div>{o.productDetails}</div>
                      <span style={{ fontSize: '11px', color: '#737373' }}>
                        Weight: {o.weight} kg | Pay: {isPartiallyPaid ? 'Partially Paid' : o.paymentType} {isPartiallyPaid && `(Paid ₹${o.partiallyPaidAmount}, Bal ₹${o.finalPayableAmount})`}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* Courier Selection Dropdown */}
                        {o.status === 'Created' || o.status === 'Packing' ? (
                          <>
                            <select
                              className="premium-input"
                              style={{ padding: '4px 8px', fontSize: '11.5px', width: '100%', borderColor: !isServiceable ? '#EF4444' : 'var(--border)' }}
                              value={activeCourier}
                              onChange={(e) => handleCourierSelectChange(o.id, e.target.value as any)}
                              disabled={isProcessing}
                            >
                              <option value="DTDC">DTDC (Priority 1)</option>
                              <option value="XpressBees Air">XpressBees Air</option>
                              <option value="XpressBees Surface">XpressBees Surface</option>
                              <option value="Delhivery">Delhivery (Priority 3)</option>
                              <option value="Aggregator">Aggregator API</option>
                            </select>
                            {!isServiceable && (
                              <span style={{ color: '#EF4444', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                ⚠️ Unserviceable with {activeCourier}
                              </span>
                            )}
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CourierLogo courier={o.courier} size={14} />
                          </div>
                        )}

                        {/* Phone selection dropdown if multiple are available */}
                        {hasMultiplePhones && !o.awb ? (
                          <div>
                            <span style={{ fontSize: '9px', color: '#737373', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Select Contact:</span>
                            <select
                              className="premium-input"
                              style={{ padding: '2px 6px', fontSize: '11px', width: '100%', borderColor: '#F59E0B' }}
                              value={activePhone}
                              onChange={(e) => handlePhoneSelectChange(o.id, e.target.value)}
                              disabled={isProcessing}
                            >
                              <option value={o.phonePrimary}>{o.phonePrimary} (Prim)</option>
                              {o.phoneSecondary && <option value={o.phoneSecondary}>{o.phoneSecondary} (Sec)</option>}
                              {o.phoneTertiary && <option value={o.phoneTertiary}>CUSTOMER_NUMBER (Tert)</option>}
                            </select>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#8A8A8A', fontFamily: 'monospace' }}>
                            {activePhone === o.phoneTertiary ? 'CUSTOMER_NUMBER' : activePhone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`premium-badge status-${o.status.toLowerCase().replace(' ', '')}`}>
                        {o.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {/* Phase 1: Generated AWB Label or Reschedule */}
                        {!o.awb && (
                          isServiceable ? (
                            <button
                              onClick={() => handleOpenSingleDispatchModal(o)}
                              className="premium-btn premium-btn-primary animate-fade-in"
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              disabled={isProcessing}
                            >
                              {isProcessing ? <span className="spinner spinner-sm" /> : <Tag size={12} />}
                              <span>{isProcessing ? 'Generating...' : 'Generate AWB'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenReassign(o)}
                              className="premium-btn animate-fade-in"
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '12px', 
                                borderColor: '#EF4444', 
                                color: '#EF4444', 
                                backgroundColor: 'rgba(239, 68, 68, 0.05)', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px' 
                              }}
                              disabled={isProcessing}
                            >
                              <RefreshCcw size={12} />
                              <span>Reassign</span>
                            </button>
                          )
                        )}

                        {/* Phase 2: AWB Generated, ready to Print Shipping Label & Dispatch */}
                        {o.awb && (
                          <>
                            <button
                              onClick={() => {
                                setPrintingOrders([o]);
                                setShowPrintLabel(true);
                              }}
                              className="premium-btn premium-btn-secondary animate-fade-in"
                              style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              disabled={isProcessing}
                            >
                              <Printer size={12} />
                              <span>Print Label</span>
                            </button>

                            {o.status !== 'Dispatched' && (
                              <button
                                onClick={() => handleDispatch(o)}
                                className="premium-btn premium-btn-primary animate-fade-in"
                                style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#10B981', borderColor: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                disabled={isProcessing}
                              >
                                {isProcessing ? <span className="spinner spinner-sm" /> : <Send size={12} />}
                                <span>Dispatch</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Shipping Label CSS Printing Modal - Configured for 4x6 inch format */}
      {showPrintLabel && printingOrders.length > 0 && (
        <div className="premium-modal-backdrop">
          <div className="premium-modal" style={{ maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
            
            {/* Header info */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ fontSize: '16px', color: '#FAFAFA' }}>
                Print queue: {printingOrders.length} Shipping Labels (4 x 6 in)
              </h3>
              <button onClick={() => setShowPrintLabel(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            {/* Scrollable preview wrapper */}
            <div style={{ backgroundColor: '#1A1A1E', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', flex: 1, overflowY: 'auto' }}>
              
              {/* Outer Printable boundary */}
              <div id="printable-labels-boundary">
                {printingOrders.map((order, idx) => (
                  <div 
                    key={order.id}
                    className="thermal-shipping-label"
                    style={{ 
                      width: '4in', // matches target dimensions closely (4in)
                      backgroundColor: '#FFFFFF',
                      pageBreakAfter: 'always',
                      marginBottom: idx < printingOrders.length - 1 ? '20px' : '0'
                    }}
                  >
                    <HealvitaShippingLabel order={order} phoneSelection={phoneSelections[order.id]} />
                  </div>
                ))}
              </div>
            </div>

            {/* Print operations bar - fixed at bottom */}
            <div className="print-operations-bar" style={{ padding: '16px 24px', backgroundColor: '#F4F4F5', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexShrink: 0, position: 'sticky', bottom: 0, zIndex: 10 }}>
              <button 
                onClick={() => setShowPrintLabel(false)} 
                className="premium-btn premium-btn-secondary" 
                style={{ color: '#000', borderColor: '#000', padding: '6px 12px' }}
              >
                Close Queue
              </button>
              
              <button 
                onClick={handlePrint} 
                className="premium-btn premium-btn-primary" 
                style={{ backgroundColor: '#000', color: '#FFF', border: 'none', padding: '6px 12px' }}
              >
                <Printer size={14} />
                <span>Print thermal labels (4x6 in)</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Fullscreen Bulk Processing Progress Modal */}
      {bulkProcessing && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(5, 5, 8, 0.92)',
            backdropFilter: 'blur(16px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FAFAFA',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#0E0E11',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Glowing radial gradient backdrop */}
            <div 
              style={{
                position: 'absolute',
                top: '-20%',
                left: '-20%',
                width: '140%',
                height: '140%',
                background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 60%)',
                pointerEvents: 'none',
                zIndex: 0
              }}
            />

            {/* Circular Progress Section */}
            <div style={{ position: 'relative', width: '130px', height: '130px', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                <circle 
                  cx="65" 
                  cy="65" 
                  r="54" 
                  stroke="rgba(255, 255, 255, 0.03)" 
                  strokeWidth="8" 
                  fill="transparent" 
                />
                <circle 
                  cx="65" 
                  cy="65" 
                  r="54" 
                  stroke="#10B981" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray="339.29"
                  strokeDashoffset={339.29 - (339.29 * (bulkProgress.current / (bulkProgress.total || 1)))}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </svg>
              <div 
                style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#FAFAFA', letterSpacing: '-0.5px' }}>
                  {Math.round((bulkProgress.current / (bulkProgress.total || 1)) * 100)}%
                </span>
                <span style={{ fontSize: '10.5px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                  Complete
                </span>
              </div>
            </div>

            {/* Heading Details */}
            <div style={{ textAlign: 'center', zIndex: 1 }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#FAFAFA' }}>
                Generating Bulk AWB Labels
              </h3>
              <p style={{ fontSize: '13px', color: '#8A8A8A', margin: '6px 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {bulkProgress.activeOrder ? (
                  <>
                    <span>Processing:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#10B981' }}>{bulkProgress.activeOrder}</span>
                  </>
                ) : (
                  <span>Preparing pipeline...</span>
                )}
              </p>
            </div>

            {/* Processing Stats Cards */}
            <div 
              style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                zIndex: 1
              }}
            >
              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px 8px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#737373', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Queue</span>
                <span style={{ fontSize: '18px', fontWeight: 750, color: '#FAFAFA', marginTop: '4px', display: 'block' }}>
                  {bulkProgress.current} / {bulkProgress.total}
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.02)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '10px', padding: '12px 8px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#10B981', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success</span>
                <span style={{ fontSize: '18px', fontWeight: 750, color: '#10B981', marginTop: '4px', display: 'block' }}>
                  {bulkProgress.success}
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.1)', borderRadius: '10px', padding: '12px 8px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#EF4444', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed</span>
                <span style={{ fontSize: '18px', fontWeight: 750, color: '#EF4444', marginTop: '4px', display: 'block' }}>
                  {bulkProgress.failed}
                </span>
              </div>
            </div>

            {/* Time Remaining Counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#A1A1AA', zIndex: 1 }}>
              <span className="spinner spinner-sm" style={{ borderColor: 'rgba(255,255,255,0.2) rgba(255,255,255,0.2) #10B981 #10B981' }} />
              <span>
                {bulkProgress.current === bulkProgress.total ? (
                  'Wrapping up...'
                ) : (
                  <>
                    Estimated time remaining:{' '}
                    <strong style={{ color: '#FAFAFA' }}>
                      {Math.max(0, Math.ceil(((bulkProgress.total - bulkProgress.current) * 1.5) / 4))}s
                    </strong>
                  </>
                )}
              </span>
            </div>

            {/* Console Log Log Output */}
            <div 
              style={{
                width: '100%',
                height: '140px',
                backgroundColor: '#050507',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '10px',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '11px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                zIndex: 1,
                scrollBehavior: 'smooth'
              }}
              ref={(el) => {
                if (el) el.scrollTop = el.scrollHeight;
              }}
            >
              {bulkProgress.completedList.length === 0 ? (
                <div style={{ color: '#55555A' }}>&gt;_ Awaiting dispatcher signals...</div>
              ) : (
                bulkProgress.completedList.map((logItem, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', lineHeight: '1.4' }}>
                    <span style={{ color: logItem.success ? '#10B981' : '#EF4444', fontWeight: 'bold' }}>
                      {logItem.success ? '✓' : '✗'}
                    </span>
                    <span style={{ color: '#88888D' }}>[{logItem.orderId}]</span>
                    <span style={{ color: logItem.success ? '#E4E4E7' : '#EF6868' }}>{logItem.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AWB Generation Exception (Formal error notification) */}
      {showAwbErrorModal && awbErrorDetails && (
        <div className="premium-modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="premium-modal animate-fade-in" style={{ maxWidth: '480px', borderColor: '#EF4444' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
                <h3 style={{ fontSize: '15px', color: '#FAFAFA', fontWeight: 600, letterSpacing: '0.3px', margin: 0 }}>AWB Generation Exception</h3>
              </div>
              <button 
                onClick={() => { setShowAwbErrorModal(false); setAwbErrorDetails(null); }} 
                style={{ background: 'none', border: 'none', color: '#737373', cursor: 'pointer', fontSize: '13px' }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: '#737373', textTransform: 'uppercase', fontSize: '10px' }}>Order Identifier</span>
                  <span style={{ color: '#FAFAFA', fontWeight: 600 }}>{awbErrorDetails.orderId}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ color: '#737373', textTransform: 'uppercase', fontSize: '10px' }}>Courier Partner</span>
                  <span style={{ color: '#FAFAFA', fontWeight: 600 }}>{awbErrorDetails.courier}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                  <span style={{ color: '#737373', textTransform: 'uppercase', fontSize: '10px' }}>Delivery Pincode</span>
                  <span style={{ color: '#FAFAFA', fontWeight: 600 }}>{awbErrorDetails.pincode}</span>
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <span style={{ display: 'block', color: '#EF4444', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>Courier Exception Response</span>
                <p style={{ color: '#F3F4F6', fontSize: '13px', margin: 0, lineHeight: '1.5', fontFamily: 'monospace' }}>
                  {awbErrorDetails.error}
                </p>
              </div>

              {/* Courier Serviceability & Reassignment Options */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ color: '#FAFAFA', fontSize: '12px', fontWeight: 600 }}>Alternative Serviceability & Reassignment:</span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {['Delhivery', 'XpressBees', 'DTDC'].map((cName) => {
                    const status = modalServiceability[cName];
                    const isCurrent = cName === awbErrorDetails.courier;
                    
                    return (
                      <div key={cName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: '#FAFAFA', fontSize: '13px', fontWeight: 500 }}>
                            {cName} {isCurrent && <span style={{ color: '#A1A1AA', fontSize: '11px' }}>(Current)</span>}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: status === 'serviceable' ? '#10B981' : (status === 'unserviceable' ? '#EF4444' : '#EAB308') }}>
                            {status === 'loading' ? '⌛ Checking serviceability...' : (status === 'serviceable' ? '✓ Serviceable' : '✗ Unserviceable')}
                          </span>
                        </div>
                        
                        {status === 'serviceable' && !isCurrent && (
                          <button
                            type="button"
                            disabled={!!inlineReassignLoading}
                            onClick={() => handleInlineReassign(awbErrorDetails.orderId, cName, awbErrorDetails.pincode)}
                            className="premium-btn"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              backgroundColor: '#FAFAFA',
                              color: '#09090B',
                              borderColor: '#FAFAFA',
                              fontWeight: 600
                            }}
                          >
                            {inlineReassignLoading === cName ? 'Reassigning...' : 'Reassign'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Warning if no other courier is serviceable */}
                {Object.keys(modalServiceability).length > 0 && 
                 Object.values(modalServiceability).every(s => s === 'unserviceable') && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', marginTop: '4px' }}>
                    <span style={{ color: '#EF4444', fontSize: '14px', lineHeight: '1.2' }}>⚠️</span>
                    <p style={{ margin: 0, fontSize: '12px', color: '#EF6868', lineHeight: '1.4' }}>
                      <strong>Zero Courier Coverage:</strong> No courier partner supports this pincode ({awbErrorDetails.pincode}) at this time. Please contact the customer to provide a serviceable address.
                    </p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowAwbErrorModal(false); setAwbErrorDetails(null); }} 
                  className="premium-btn premium-btn-primary"
                  style={{ backgroundColor: '#EF4444', borderColor: '#EF4444', color: '#FFFFFF' }}
                >
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reassign Order (Unserviceable Pincode) */}
      {showReassignModal && reassignOrder && (
        <div className="premium-modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="premium-modal" style={{ maxWidth: '520px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Reassign Order: {reassignOrder.orderId}</h3>
              <button onClick={() => { setShowReassignModal(false); setReassignOrder(null); }} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <form onSubmit={handleConfirmReassign} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Select Courier Partner *</label>
                <select
                  className="premium-input"
                  value={reassignCourier}
                  onChange={(e) => {
                    const newCourier = e.target.value;
                    setReassignCourier(newCourier);
                    setReassignRemark(`Pincode ${reassignOrder.pincode} is not serviceable with ${reassignOrder.courier || 'DTDC'}. Reassigned order to ${newCourier}.`);
                  }}
                  required
                >
                  <option value="DTDC">DTDC</option>
                  <option value="XpressBees">XpressBees</option>
                  <option value="Delhivery">Delhivery</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Reassign Reason / Remark *</label>
                <textarea
                  className="premium-input"
                  placeholder="Enter details explaining why this order is reassigned..."
                  value={reassignRemark}
                  onChange={(e) => setReassignRemark(e.target.value)}
                  style={{ minHeight: '80px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowReassignModal(false); setReassignOrder(null); }} className="premium-btn premium-btn-secondary">Close</button>
                <button type="submit" className="premium-btn premium-btn-primary" disabled={reassignLoading}>
                  {reassignLoading ? 'Reassigning...' : 'Confirm Reassign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Reassign Courier */}
      {showBulkReassignModal && (
        <div className="premium-modal-backdrop" style={{ zIndex: 1100 }}>
          <div className="premium-modal" style={{ maxWidth: '500px' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', color: '#FAFAFA' }}>Bulk Reassign Courier ({selectedIds.length} Orders)</h3>
              <button onClick={() => setShowBulkReassignModal(false)} style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer' }}>Close</button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{ fontSize: '13px', color: '#A3A3A3', margin: 0, lineHeight: '1.5' }}>
                You have selected <strong>{selectedIds.length}</strong> orders to reassign. Choose an alternative courier partner to route these shipments. This will clear any previously generated AWB numbers for these orders and set them back to ready state.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#737373', marginBottom: '6px', textTransform: 'uppercase' }}>Select New Courier Partner *</label>
                <select
                  className="premium-input"
                  value={bulkReassignCourier}
                  onChange={(e) => setBulkReassignCourier(e.target.value)}
                  required
                >
                  <option value="DTDC">DTDC Express</option>
                  <option value="XpressBees">XpressBees Logistics</option>
                  <option value="Delhivery">Delhivery Express</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowBulkReassignModal(false)} className="premium-btn premium-btn-secondary">Cancel</button>
                <button 
                  type="button" 
                  onClick={handleBulkReassign} 
                  className="premium-btn premium-btn-primary" 
                  style={{ backgroundColor: '#EF4444', borderColor: '#EF4444', color: '#FFFFFF' }}
                  disabled={bulkReassignLoading}
                >
                  {bulkReassignLoading ? 'Reassigning...' : 'Confirm Bulk Reassign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Single AWB Generation Dispatch Modal */}
      {singleDispatchOrder && (
        <div className="premium-modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="premium-modal animate-fade-in" style={{ maxWidth: '460px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={16} style={{ color: '#3B82F6' }} />
                <h3 style={{ fontSize: '15px', color: '#FAFAFA', fontWeight: 600, margin: 0 }}>Configure Parcel Dispatch ({singleDispatchOrder.orderId})</h3>
              </div>
              <button 
                onClick={() => setSingleDispatchOrder(null)} 
                style={{ background: 'none', border: 'none', color: '#737373', cursor: 'pointer', fontSize: '13px' }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#A1A1AA', display: 'block', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                  Select Courier Partner:
                </label>
                <select
                  className="premium-input"
                  style={{ padding: '8px 12px', fontSize: '13px', width: '100%', borderColor: '#3B82F6' }}
                  value={singleDispatchCourier}
                  onChange={(e) => setSingleDispatchCourier(e.target.value)}
                >
                  <option value="DTDC">DTDC Express (Priority 1)</option>
                  <option value="XpressBees">XpressBees Logistics</option>
                  <option value="Delhivery">Delhivery Express</option>
                  <option value="Aggregator">Aggregator API</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#A1A1AA', display: 'block', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                  Select Primary Parcel Contact Number:
                </label>
                <select
                  className="premium-input"
                  style={{ padding: '8px 12px', fontSize: '13px', width: '100%', borderColor: '#F59E0B' }}
                  value={singleDispatchPhoneChoice}
                  onChange={(e) => setSingleDispatchPhoneChoice(e.target.value)}
                >
                  <option value="Primary">Primary Customer Phone: {singleDispatchOrder.phonePrimary}</option>
                  {singleDispatchOrder.phoneSecondary && (
                    <option value="Secondary">Secondary Phone: {singleDispatchOrder.phoneSecondary}</option>
                  )}
                  {singleDispatchOrder.phoneTertiary && (
                    <option value="Tertiary">Tertiary Customer Number</option>
                  )}
                  <option value="Custom">Custom Phone Number Input</option>
                </select>

                {singleDispatchPhoneChoice === 'Custom' && (
                  <input
                    type="text"
                    className="premium-input"
                    style={{ marginTop: '8px', padding: '8px 12px', fontSize: '13px', width: '100%' }}
                    placeholder="Enter 10-digit primary phone number..."
                    value={singleDispatchCustomPhone}
                    onChange={(e) => setSingleDispatchCustomPhone(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#09090B' }}>
              <button onClick={() => setSingleDispatchOrder(null)} className="premium-btn premium-btn-secondary" style={{ padding: '6px 14px' }}>
                Cancel
              </button>
              <button onClick={confirmSingleDispatch} className="premium-btn premium-btn-primary" style={{ padding: '6px 16px', backgroundColor: '#3B82F6', borderColor: '#3B82F6' }}>
                Confirm & Generate AWB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Bulk AWB Generation Dispatch Modal */}
      {showBulkDispatchModal && (
        <div className="premium-modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="premium-modal animate-fade-in" style={{ maxWidth: '460px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={16} style={{ color: '#3B82F6' }} />
                <h3 style={{ fontSize: '15px', color: '#FAFAFA', fontWeight: 600, margin: 0 }}>Bulk Configure Parcel Dispatches</h3>
              </div>
              <button 
                onClick={() => setShowBulkDispatchModal(false)} 
                style={{ background: 'none', border: 'none', color: '#737373', cursor: 'pointer', fontSize: '13px' }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span style={{ fontSize: '13px', color: '#A1A1AA' }}>
                Configuring bulk AWB generation for <strong style={{ color: '#FAFAFA' }}>{orders.filter(o => selectedIds.includes(o.id) && !o.awb).length}</strong> selected pending parcels.
              </span>

              <div>
                <label style={{ fontSize: '11px', color: '#A1A1AA', display: 'block', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                  Select Courier Partner:
                </label>
                <select
                  className="premium-input"
                  style={{ padding: '8px 12px', fontSize: '13px', width: '100%', borderColor: '#3B82F6' }}
                  value={bulkDispatchCourier}
                  onChange={(e) => setBulkDispatchCourier(e.target.value)}
                >
                  <option value="DTDC">DTDC Express (Priority 1)</option>
                  <option value="XpressBees">XpressBees Logistics</option>
                  <option value="Delhivery">Delhivery Express</option>
                  <option value="Aggregator">Aggregator API</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#A1A1AA', display: 'block', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                  Select Primary Parcel Phone Binding:
                </label>
                <select
                  className="premium-input"
                  style={{ padding: '8px 12px', fontSize: '13px', width: '100%', borderColor: '#F59E0B' }}
                  value={bulkDispatchPhoneBinding}
                  onChange={(e) => setBulkDispatchPhoneBinding(e.target.value)}
                >
                  <option value="Primary">Primary Store Phone (Default)</option>
                  <option value="Secondary">Secondary Hub Phone</option>
                  <option value="Tertiary">Tertiary Customer Phone</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#09090B' }}>
              <button onClick={() => setShowBulkDispatchModal(false)} className="premium-btn premium-btn-secondary" style={{ padding: '6px 14px' }}>
                Cancel
              </button>
              <button 
                onClick={() => executeBulkGenerateLabels(bulkDispatchCourier, bulkDispatchPhoneBinding)} 
                className="premium-btn premium-btn-primary" 
                style={{ padding: '6px 16px', backgroundColor: '#3B82F6', borderColor: '#3B82F6' }}
              >
                Start Bulk AWB Generation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
