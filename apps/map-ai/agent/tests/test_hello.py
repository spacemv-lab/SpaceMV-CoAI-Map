# Copyright (c) 2026 成都天巡微小卫星科技有限责任公司
# This project is licensed under the MIT License - see the LICENSE file in the project root for details.


"""Hello unit test module."""

from .hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello "
