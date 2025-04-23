import { BankAccountsList } from '@/components/bank-accounts/bank-accounts-list';
import { Container } from '@/components/ui/container';

export default function BankAccountsPage() {
  return (
    <Container className="py-8">
      <BankAccountsList />
    </Container>
  );
}