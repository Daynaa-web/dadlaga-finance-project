import { supabase } from '/supabase.js';

// HTML Элементүүдийг барьж авах
const transactionForm = document.getElementById('transaction-form');
const txTypeInput = document.getElementById('tx-type');
const txCategoryInput = document.getElementById('tx-category');
const txAmountInput = document.getElementById('tx-amount');
const txDateInput = document.getElementById('tx-date');
const txDescInput = document.getElementById('tx-desc');
const btnLogout = document.getElementById('btn-logout');

const budgetForm = document.getElementById('budget-form');
const budgetCategoryInput = document.getElementById('budget-category');
const budgetAmountInput = document.getElementById('budget-amount');
const budgetMonthInput = document.getElementById('budget-month');

// 🏆 Цол, Бонус болон Хөнгөлөлтийн системүүдийн үндсэн дүрэм (Англи хэл дээр)
const RANK_RULES = {
    0: {
        title: "Beginner",
        bonus: 0,
        perks: ["Keep tracking your transactions to level up!"]
    },
    1: {
        title: "Financial Cadet",
        bonus: 500,
        perks: [" CU Coffee 10% OFF", " Internom 5% OFF"]
    },
    2: {
        title: "Budget Master",
        bonus: 1500,
        perks: [" CU Coffee 20% OFF", " E-Mart 5,000 ₮ Coupon", " Tengis Cinema 15% OFF"]
    },
    3: {
        title: "Financial Freedom",
        bonus: 5000,
        perks: [" VIP 15% OFF on all partners", " XacBank account fee 0 ₮"]
    }
};

// Хуудас ачаалагдаж дуусах үед ажиллах хэсэг
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return;
    }
    
    console.log("Холбогдсон байна.");
    const userEmailElem = document.getElementById('user-email');
    if (userEmailElem) {
        userEmailElem.textContent = user.email;
    }

    await fetchTransactions(); 
    await fetchBudgets();
    await fetchAndRenderBadges(); // 🏅 Тэмдэг болон Цол ачаалах
});

// Шинэ гүйлгээ нэмэх (Submit)
if (transactionForm) {
    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = txTypeInput.value;
        const category = txCategoryInput.value;
        const amount = parseFloat(txAmountInput.value);
        const date = txDateInput.value;
        const description = txDescInput.value;

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            alert("Сешн дууссан байна. Дахин нэвтэрнэ үү!");
            window.location.href = 'index.html';
            return;
        }

        // ========================================================
        // 🚨 ТӨСӨВ ХЭТЭРСЭН ЭСЭХИЙГ ШАЛГАЖ АСУУХ ЛОГИК
        // ========================================================
        if (type === 'expense') {
            const currentMonthYear = date.substring(0, 7);

            const { data: budgetData } = await supabase
                .from('budgets')
                .select('limit_amount')
                .eq('user_id', user.id)
                .eq('category', category)
                .eq('month_year', currentMonthYear)
                .maybeSingle(); 

            if (budgetData) {
                const limitAmount = budgetData.limit_amount;

                const { data: pastExpenses } = await supabase
                    .from('transactions')
                    .select('amount, date')
                    .eq('user_id', user.id)
                    .eq('type', 'expense')
                    .eq('category', category);
                
                let totalPastExpense = 0;
                if (pastExpenses) {
                    pastExpenses.forEach(tx => {
                        if (tx.date && tx.date.substring(0, 7) === currentMonthYear) {
                            totalPastExpense += tx.amount;
                        }
                    });
                }

                if (totalPastExpense + amount > limitAmount) {
                    const currentTotal = totalPastExpense + amount;
                    
                    const proceed = confirm(
                        `АНХААРУУЛГА!\n\nТаны ${currentMonthYear} сарын "${category}" ангиллын төсвийн хязгаар: ${limitAmount.toLocaleString()} ₮\nОдоогийн нийт зарцуулалт: ${currentTotal.toLocaleString()} ₮ болох гэж байна.\n\nТөсөв хэтрүүлж гүйлгээг үргэлжлүүлэн хадгалах уу?`
                    );
                    
                    if (!proceed) {
                        return; 
                    }
                }
            }
        }
        // ========================================================

        const { error } = await supabase.from('transactions').insert([
            {
                user_id: user.id,
                type: type,
                category: category,
                amount: amount,
                description: description,
                date: date,
            }
        ]);

        if (error) {
            alert("Гүйлгээг хадгалахад алдаа гарлаа: " + error.message);
        } else {
            alert("Гүйлгээ амжилттай бүртгэгдлээ!");
            transactionForm.reset();

            // 🏅 Шалгуурууд хангасан бол автомат тэмдэг олгоно
            await awardBadge('Анхны алхам'); 
            const currentMonthYear = date.substring(0, 7);
            await checkSaverBadge(user, currentMonthYear);
        }
        
        await fetchTransactions();
    });
}

// Баазаас гүйлгээ уншиж ирэх функц
async function fetchTransactions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    if (error) {
        console.error("Гүйлгээ уншихад алдаа гарлаа:", error.message);
        return;
    }

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += tx.amount;
        } else if (tx.type === 'expense') {
            totalExpense += tx.amount;
        }
    });

    const totalBalance = totalIncome - totalExpense;

    const balanceElem = document.getElementById('total-balance');
    const incomeElem = document.getElementById('total-income');
    const expenseElem = document.getElementById('total-expense');

    if (balanceElem) balanceElem.textContent = `${totalBalance.toLocaleString()} ₮`;
    if (incomeElem) incomeElem.textContent = `${totalIncome.toLocaleString()} ₮`;
    if (expenseElem) expenseElem.textContent = `${totalExpense.toLocaleString()} ₮`;

    renderTransactions(transactions);
}

// Датаг хүснэгтэд харуулах функц
function renderTransactions(transactions) {
    const listContainer = document.getElementById('transaction-list');
    if (!listContainer) return;
    
    if (transactions.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="fa-solid fa-folder-open fs-3 d-block mb-2"></i>
                    Одоогоор ямар нэгэн гүйлгээ бүртгэгдээгүй байна.
                </td>
            </tr>
        `;
        return;
    }

    let htmlContent = '';
    
    transactions.forEach(tx => {
        const isIncome = tx.type === 'income';
        const badgeColor = isIncome ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
        const typeText = isIncome ? 'Орлого' : 'Зарлага';
        const amountSign = isIncome ? '+' : '-';
        const amountColor = isIncome ? 'text-success' : 'text-danger';

        htmlContent += `
            <tr>
                <td>${tx.date || ''}</td>
                <td><span class="badge bg-light text-dark shadow-sm border">${tx.category || 'Бусад'}</span></td>
                <td class="text-secondary fw-medium">${tx.description || ''}</td>
                <td><span class="badge ${badgeColor}">${typeText}</span></td>
                <td class="text-end fw-bold ${amountColor}">${amountSign}${(tx.amount || 0).toLocaleString()} ₮</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteTransaction('${tx.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    listContainer.innerHTML = htmlContent;
}

// Устгах функц
window.deleteTransaction = async function(id) {
    const confirmDelete = confirm("Та энэ гүйлгээг устгахдаа итгэлтэй байна уу?");
    if (!confirmDelete) return;

    try {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert("Гүйлгээ амжилттай устгагдлаа.");
        await fetchTransactions();

    } catch (error) {
        alert("Гүйлгээ устгахад алдаа гарлаа: " + error.message);
    }
}

// Төсвүүдийг уншиж Offcanvas дээр жагсаах
async function fetchBudgets() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: budgets, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .order('month_year', { ascending: false });

    if (error) {
        console.error("Төсөв уншихад алдаа гарлаа:", error.message);
        return;
    }

    const budgetsContainer = document.getElementById('current-budgets-list');
    if (!budgetsContainer) return;
    
    if (!budgets || budgets.length === 0) {
        budgetsContainer.innerHTML = `
            <h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>
            <div class="text-center py-3 text-muted small bg-light rounded">Одоогоор төсөв тогтоогоогүй байна.</div>
        `;
        return;
    }

    let htmlContent = `<h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>`;
    
    budgets.forEach(b => {
        htmlContent += `
            <div class="card p-2 mb-2 bg-light border-0 shadow-sm">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="fw-bold small text-dark">${b.category}</span>
                        <span class="text-muted mx-1">•</span>
                        <span class="small text-secondary">${b.month_year}</span>
                    </div>
                    <span class="fw-bold text-primary small">${b.limit_amount.toLocaleString()} ₮</span>
                </div>
            </div>
        `;
    });

    budgetsContainer.innerHTML = htmlContent;
}

// Төсөв тогтоох форм илгээх хэсэг
if (budgetForm) {
    budgetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const category = budgetCategoryInput.value;
        const limitAmount = parseFloat(budgetAmountInput.value);
        const monthYear = budgetMonthInput.value; 

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('budgets')
            .insert([
                {
                    user_id: user.id,
                    category: category,
                    limit_amount: limitAmount,
                    month_year: monthYear
                }
            ]);

        if (error) {
            alert("Төсөв тогтооход алдаа гарлаа: " + error.message);
        } else {
            alert(`${monthYear} сарын ${category} ангилалд төсөв амжилттай тогтоогдлоо!`);
            budgetForm.reset();
            
            const instance = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasBudget'));
            if (instance) instance.hide();
            
            await fetchBudgets();
            await awardBadge('Төсөвлөгч'); // 🏅 Анхны төсөв тогтоосон тэмдэг олгох
        }
    });
}

// Гарах товч
// Гарах товч
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        const confirmLogout = confirm("Та системээс гарахдаа итгэлтэй байна уу?");
        if (!confirmLogout) return;

        try {
            // ЭНД ЗАСВАР ОРУУЛСАН: supabase.signOut() -> supabase.auth.signOut()
            const { error } = await supabase.auth.signOut();
            
            if (error) throw error;
            window.location.href = 'index.html';
        } catch (error) {
            alert("Системээс гарахад алдаа гарлаа: " + error.message);
        }
    });
}

// ========================================================
// 🏅 BADGES & RANKS (ТЭМДЭГ БОЛОН ЦОЛ) СИСТЕМИЙН ФУНКЦҮҮД
// ========================================================

// 1. Хэрэглэгчийн авсан тэмдгүүдийг баазаас уншиж зурах + Цол бодох
async function fetchAndRenderBadges() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return;

        // Зөвхөн цэвэрхэн текстээр баганыг дуудна
        const { data: badges, error } = await supabase
            .from('badges')
            .select('badge_name')
            .eq('user_id', user.id);

        if (error) {
            console.error("Badge уншихад алдаа гарлаа:", error.message);
            return;
        }

        const badgesContainer = document.getElementById('user-badges');
        if (!badgesContainer) return;

        let htmlContent = '';
        badges.forEach(b => {
            let badgeColor = 'bg-secondary';
            let icon = '';
            
            if (b.badge_name === 'Анхны алхам') { badgeColor = 'bg-warning text-dark'; icon = ''; }
            if (b.badge_name === 'Төсөвлөгч') { badgeColor = 'bg-info text-dark'; icon = ''; }
            if (b.badge_name === 'Хэмнэгч') { badgeColor = 'bg-success'; icon = ''; }

            htmlContent += `<span class="badge ${badgeColor} d-flex align-items-center gap-1 shadow-sm" title="${b.badge_name}">${icon} ${b.badge_name}</span>`;
        });
        badgesContainer.innerHTML = htmlContent;

        // 🏆 ЦОЛ, БОНУС, ХӨНГӨЛӨЛТ БОДОХ ЛОГИК
        const badgeCount = badges.length; 
        let currentRankKey = 0;

        if (badgeCount >= 3) currentRankKey = 3;
        else if (badgeCount === 2) currentRankKey = 2;
        else if (badgeCount === 1) currentRankKey = 1;

        const currentRank = RANK_RULES[currentRankKey];

        const rankElem = document.getElementById('user-rank');
        const bonusElem = document.getElementById('user-bonus');
        const discountsContainer = document.getElementById('user-discounts');

        // Англи хэл дээр цолыг солих
        if (rankElem) rankElem.textContent = ` ${currentRank.title}`;
        if (bonusElem) bonusElem.textContent = `${currentRank.bonus.toLocaleString()} Points`;

        if (discountsContainer) {
            let discountsHtml = '';
            currentRank.perks.forEach(perk => {
                discountsHtml += `<span class="badge bg-white text-dark border border-danger-subtle px-2 py-1.5 shadow-sm small fw-medium"><i class="fa-solid fa-gift text-danger me-1"></i>${perk}</span>`;
            });
            discountsContainer.innerHTML = discountsHtml;
        }
    } catch (err) {
        console.error("fetchAndRenderBadges системд алдаа гарлаа:", err);
    }
}

// 2. Шинэ тэмдэг бааз руу нэмэх (awarded_at нэмсэн хувилбар)
async function awardBadge(badgeName) {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return;

        // Зөрчил үүсгэхгүйгээр тухайн тэмдэг байгаа эсэхийг уншина
        const { data: existingBadges, error: checkError } = await supabase
            .from('badges')
            .select('id')
            .eq('user_id', user.id)
            .eq('badge_name', badgeName);

        if (checkError) {
            console.error("Тэмдэг шалгахад алдаа гарлаа:", checkError.message);
            return;
        }

        // Хэрэв баазад байхгүй бол шинээр оруулна
        if (!existingBadges || existingBadges.length === 0) {
            const { error: insertError } = await supabase
                .from('badges')
                .insert([
                    { 
                        user_id: user.id, 
                        badge_name: badgeName,
                        awarded_at: new Date().toISOString() // Баганын Default алдаанаас сэргийлнэ
                    }
                ]);
            
            if (insertError) {
                console.error("Бааз руу тэмдэг хадгалахад алдаа гарлаа:", insertError.message);
            } else {
                alert(` Congratulations! You've earned a new badge: "${badgeName}"`);
                await fetchAndRenderBadges();
            }
        }
    } catch (err) {
        console.error("awardBadge системд алдаа гарлаа:", err);
    }
}

// 3. Зарлага хийх үед төсөв хэтрээгүй бол "Хэмнэгч" тэмдэг олгох шалгуур
async function checkSaverBadge(user, currentMonthYear) {
    try {
        const { data: budgets, error: budgetError } = await supabase
            .from('budgets')
            .select('limit_amount')
            .eq('user_id', user.id)
            .eq('month_year', currentMonthYear);

        if (budgetError) return;

        let totalBudgetLimit = 0;
        if (budgets) budgets.forEach(b => totalBudgetLimit += b.limit_amount);

        if (totalBudgetLimit === 0) return; 

        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('amount, date, type')
            .eq('user_id', user.id)
            .eq('type', 'expense');

        if (txError) return;

        let totalExpense = 0;
        if (transactions) {
            transactions.forEach(tx => {
                if (tx.date && tx.date.substring(0, 7) === currentMonthYear) {
                    totalExpense += tx.amount;
                }
            });
        }

        if (totalExpense > 0 && totalExpense <= totalBudgetLimit) {
            await awardBadge('Хэмнэгч');
        }
    } catch (err) {
        console.error("checkSaverBadge системд алдаа гарлаа:", err);
    }
}