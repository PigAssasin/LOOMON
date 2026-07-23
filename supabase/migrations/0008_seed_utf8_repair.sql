update catalog.term_localizations tl
set label = fixes.label
from catalog.terms t
join catalog.vocabularies v on v.id = t.vocabulary_id
join (
  values
    ('drinkware', 'Đồ uống'),
    ('tableware', 'Đồ bàn ăn'),
    ('decor', 'Trang trí'),
    ('tea', 'Trà'),
    ('gifts', 'Quà tặng')
) as fixes(code, label) on fixes.code = t.code
where tl.term_id = t.id
  and tl.locale = 'vi'
  and v.code = 'category';

update catalog.makers m
set
  display_name = fixes.display_name,
  province_code = fixes.province_code
from (
  values
    ('lo-may', 'Lò Mây', 'Hà Nội'),
    ('dat-studio', 'Đất Studio', 'Quảng Nam'),
    ('nang-gom', 'Nắng Gốm', 'Bình Dương'),
    ('lam-xuong', 'Lam Xưởng', 'Thừa Thiên Huế'),
    ('moc-nhien', 'Mộc Nhiên', 'Lâm Đồng'),
    ('tre-may-collective', 'Tre Mây Collective', 'Hà Nội')
) as fixes(slug, display_name, province_code)
where m.slug = fixes.slug;

update catalog.product_localizations
set
  short_description = 'Sản phẩm thủ công Việt Nam được chuẩn hóa cho báo giá và đặt hàng.',
  story = 'Một sản phẩm được làm bằng tay tại xưởng Việt Nam, với dữ liệu rõ ràng về vật liệu, số lượng tối thiểu, thời gian sản xuất và khả năng tùy chỉnh.'
where locale = 'vi';

update search.product_documents pd
set
  canonical_content = pl.title || ' quà tặng thủ công Việt Nam gốm sứ tùy chỉnh',
  generated_at = now()
from catalog.product_localizations pl
where pl.product_version_id = pd.product_version_id
  and pl.locale = pd.locale
  and pd.locale = 'vi';
