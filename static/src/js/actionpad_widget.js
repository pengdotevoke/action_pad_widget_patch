/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ActionpadWidget } from "@point_of_sale/app/screens/product_screen/action_pad/action_pad";

patch(ActionpadWidget.prototype, {
    async printOrder() {
        const order = this.pos.get_order(); // Get the current order
        if (!order) {
            console.warn("No active order found.");
            return;
        }

        const orderLines = order.orderlines;
        if (!orderLines.length) {
            console.warn("No order lines found.");
            return;
        }

        const isCancellation = orderLines.some(line => line.get_quantity() < 0);
        const orderType = isCancellation ? "Kitchen Order: Cancellation" : "Kitchen Order";

        // Retrieve order details
        const table = order.pos.table?.name || "N/A";
        const numcustomers = order.customerCount || "N/A";
        const orderDate = order.creation_date || new Date().toLocaleDateString();
        const orderTime = new Date().toLocaleTimeString();

        // Get order lines with hasChange = true and format them into HTML
        const changedLines = orderLines.filter(line => line.hasChange);
        const orderLinesHtml = changedLines.length
            ? changedLines.map((line) => `
                <tr>
                    <td>${line.get_product().display_name}<br/> ${line.customerNote ? line.customerNote : ''}</td>
                    <td>${line.get_quantity()}</td>
                </tr>
            `).join("")
            : "<tr><td colspan='2' style='text-align: center; color: red;'>No new items to print</td></tr>";

        // Generate printable HTML
        const receiptHtml = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h2 { text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid black; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .note { margin-bottom: 10px; padding: 10px; border: 1px dashed #000; font-style: italic; }
                </style>
            </head>
            <body>
                <h2>${orderType}</h2>                
                <div class="details" style='text-align: center;'>
                    <p>Table: ${table} | Customers: ${numcustomers}</p>
                    <p>Date: ${orderDate} | Time: ${orderTime}</p>
                </div>
                <table>
                    <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                    </tr>
                    ${orderLinesHtml}
                </table>
            </body>
            </html>
        `;

        // Create an iframe, inject the receipt, and trigger print
        const iframe = document.createElement("iframe");
        iframe.style.position = "absolute";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        document.body.appendChild(iframe);

        iframe.onload = () => {
            if (iframe.contentWindow) {
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }
        };

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(receiptHtml);
        iframeDoc.close();
    },

    async submitOrder() {
        if (!this.clicked) {
            this.clicked = true;
            try {
                await this.printOrder();
                await this.pos.sendOrderInPreparationUpdateLastChange(this.currentOrder);
            } finally {
                this.clicked = false;
            }
        }
    },
});
