import { supabase } from './supabase.js';

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

// Хуудас ачаалагдаж дуусах үед ажиллах хэсэг
document.addEventListener('DOMContentLoaded', async () => {
    // Хэрэглэгч нэвтэрсэн эсэхийг шалгана
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = 'index.html';
        return;
    }
    
    // Хэрэв нэвтэрсэн бол имэйлийг нь харуулна
    const userEmailElem = document.getElementById('user-email');
    if (userEmailElem) {
        userEmailElem.textContent = user.email;
    }

    // Жагсаалтуудыг баазаас татах
    await fetchTransactions(); 
    await fetchBudgets();
});

// Шинэ гүйлгээ нэмэх (Submit)
if (transactionForm) {
    transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Хуудас дахин ачаалагдахыг зогсооно

        // Формоос утгуудыг уншиж авах
        const type = txTypeInput.value;
        const category = txCategoryInput.value;
        const amount = parseFloat(txAmountInput.value);
        const date = txDateInput.value;
        const description = txDescInput.value;

        // Хэрэглэгчийн мэдээллийг авах
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            alert("Сешн дууссан байна. Дахин нэвтэрнэ үү!");
            window.location.href = 'index.html';
            return;
        }

        // ========================================================
        // 🚨 ЧИНИЙ ХҮССЭН: ТӨСӨВ ХЭТЭРСЭН ЭСЭХИЙГ ШАЛГАЖ АСУУХ ЛОГИК
        // ========================================================
        if (type === 'expense') {
            // Огнооноос Жил-Сарыг салгах (Жишээ нь: "2026-06-10" -> "2026-06")
            const currentMonthYear = date.substring(0, 7);

            // 1. Энэ сард, энэ ангилалд тогтоосон төсөв байгаа эсэхийг баазаас хайх
            const { data: budgetData } = await supabase
                .from('budgets')
                .select('limit_amount')
                .eq('user_id', user.id)
                .eq('category', category)
                .eq('month_year', currentMonthYear)
                .maybeSingle(); 

            // Хэрэв төсөв олдвол цааш шалгана
            if (budgetData) {
                const limitAmount = budgetData.limit_amount;

                // 2. Энэ сард, энэ ангилалд урьд нь хийгдсэн бүх зарлагуудыг татах
                const { data: pastExpenses } = await supabase
                    .from('transactions')
                    .select('amount, date')
                    .eq('user_id', user.id)
                    .eq('type', 'expense')
                    .eq('category', category);
                
                // Энэ сард хамаарах зарлагуудын нийлбэрийг олох
                let totalPastExpense = 0;
                if (pastExpenses) {
                    pastExpenses.forEach(tx => {
                        if (tx.date && tx.date.substring(0, 7) === currentMonthYear) {
                            totalPastExpense += tx.amount;
                        }
                    });
                }

                // 3. Хуучин зарлагууд дээр ОДООНЫ ШИНЭ зарлагыг нэмээд лимитээс давж байгааг шалгах
                if (totalPastExpense + amount > limitAmount) {
                    const currentTotal = totalPastExpense + amount;
                    
                    // Хэрэглэгчээс асуух цонх гаргана
                    const proceed = confirm(
                        `АНХААРУУЛГА!\n\nТаны ${currentMonthYear} сарын "${category}" ангиллын төсвийн хязгаар: ${limitAmount.toLocaleString()} ₮\nОдоогийн нийт зарцуулалт: ${currentTotal.toLocaleString()} ₮ болох гэж байна.\n\nТөсөв хэтрүүлж гүйлгээг үргэлжлүүлэн хадгалах уу?`
                    );
                    
                    // Хэрэв хэрэглэгч "Цуцлах" (Cancel) дарвал кодыг энд зогсооно! Бааз руу ИНСЕРТ хийхгүй.
                    if (!proceed) {
                        return; 
                    }
                }
            }
        }
        // ========================================================

        // Хэрэв төсөв хэтрээгүй, эсвэл хэтэрсэн ч хэрэглэгч "Үргэлжлүүлэх" гэж зөвшөөрсөн бол энд ирж хадгална:
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
        }
        
        // Жагсаалтыг шинэчлэх
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

// Төсвүүдийг уншиж Offcanvas дээр жагсаах функц
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
        }
    });
}

// Гарах товч
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        const confirmLogout = confirm("Та системээс гарахдаа итгэлтэй байна уу?");
        if (!confirmLogout) return;

        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            window.location.href = 'index.html';
        } catch (error) {
            alert("Системээс гарахад алдаа гарлаа: " + error.message);
        }
    });
}