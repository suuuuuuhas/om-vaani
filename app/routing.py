from pathlib import Path
import yaml

CATEGORIES = yaml.safe_load((Path(__file__).parent / 'categories.yaml').read_text(encoding='utf-8'))


def routing_steps(category: str) -> list[dict]:
    if CATEGORIES[category]['route'] == 'banking':
        return [
            {'title': 'Contact the bank or payment app', 'detail': 'Raise a complaint through its official support channel. Keep the transaction reference and acknowledgement.', 'url': None},
            {'title': 'Check RBI Ombudsman eligibility', 'detail': 'If you are dissatisfied with the response, or receive no reply within the applicable waiting period (normally 30 days, subject to RBI/NPCI/card-network rules), check eligibility on RBI CMS. Do not wait if fraud is ongoing.', 'url': 'https://cms.rbi.org.in'},
        ]
    return [
        {'title': 'Contact the company, shop or manufacturer', 'detail': 'Use the official support or grievance channel. Attach available receipts and keep the acknowledgement.', 'url': None},
        {'title': 'National Consumer Helpline', 'detail': 'If unresolved, approach NCH online or call 1915. NCH is a pre-litigation grievance service; a remedy is not guaranteed.', 'url': 'https://consumerhelpline.gov.in'},
        {'title': 'Consider the appropriate Consumer Commission', 'detail': 'Check jurisdiction, eligibility, evidence and current procedure through official consumer resources before proceeding.', 'url': 'https://consumerhelpline.gov.in/public/about'},
    ]
