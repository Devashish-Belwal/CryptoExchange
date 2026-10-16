import { MarketOrderType } from "@workspace/shared";

export function remaining(order: MarketOrderType): number {
    return order.quantity - order.filledQuantity;
}

export class OrderNode {
    order: MarketOrderType;
    next: OrderNode | null = null;
    prev: OrderNode | null = null;

    constructor(order: MarketOrderType) {
        this.order = order;
    }
}

export class OrderList {
    head: OrderNode | null = null;
    tail: OrderNode | null = null;
    size = 0;
    totalQty = 0;

    append(order: MarketOrderType): OrderNode {
        const node = new OrderNode(order);

        if (!this.head) {
            this.head = this.tail = node;
        } else {
            node.prev = this.tail;
            this.tail!.next = node;
            this.tail = node;
        }
        this.totalQty += remaining(order);
        this.size++;
        return node;
    }

    remove(node: OrderNode) {
        const qty = remaining(node.order);

        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }

        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }

        node.next = null;
        node.prev = null;
        this.totalQty -= qty;
        this.size--;
    }

    shift(): OrderNode | null {
        if (!this.head) return null;
        const node = this.head;
        this.remove(node)
        return node;
    }

    decreaseQty(qty: number) {
        this.totalQty = this.totalQty - qty;
    }

    isEmpty() {
        return this.size === 0
    }

}